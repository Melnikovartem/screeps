import { hiveStates } from "../enums";

import { profile } from "../profiler/decorator";
import { HIVE_ENERGY } from "../hive";
import { TERMINAL_ENERGY } from "../cells/stage1/storageCell";
import { MARKET_LAG } from "./broker";
import { COMPRESS_MAP } from "../cells/stage1/factoryCell"; // COMMODITIES_TO_SELL

import type { Hive, ResTarget } from "../hive";

const PADDING_RESOURCE = MAX_CREEP_SIZE * LAB_BOOST_MINERAL;

const BUY_SHORTAGES_CYCLE = 5;

let ALLOWED_TO_BUYIN: ResourceConstant[] = ["H", "K", "L", "U", "X", "O", "Z"];

switch (Game.shard.name) {
  case "shard2":
    ALLOWED_TO_BUYIN = ALLOWED_TO_BUYIN;
    break;
  case "shard3":
    ALLOWED_TO_BUYIN = ["H", "K", "L", "U", "X", "Z"];
    break;
}

@profile
export class Network {
  nodes: Hive[] = [];
  aid: { [hiveNameFrom: string]: { to: string, res: ResourceConstant, amount: number } } = {} // from -> to
  resState: ResTarget = {};

  constructor(hives?: { [id: string]: Hive }) {
    if (!hives)
      return;
    this.nodes = _.filter(hives, h => h.cells.storage && h.cells.storage.terminal);
    _.forEach(this.nodes, node => {
      Apiary.broker.shortOrdersSell[node.roomName] = { orders: {}, lastUpdated: Game.time };
    });
  }

  update() {
    this.resState = {};
    _.forEach(Apiary.hives, hive => this.updateState(hive));

    if (Game.time % BUY_SHORTAGES_CYCLE === 0 && Game.time !== Apiary.createTime)
      for (let i = 0; i < this.nodes.length; ++i)
        this.askAid(this.nodes[i]);

    for (const hiveName in this.aid) {
      let hive = Apiary.hives[hiveName];
      let sCell = hive.cells.storage;
      if (!sCell)
        continue;
      let aid = this.aid[hiveName];
      aid.amount = this.calcAmount(hiveName, aid.to, aid.res);
      if (!this.hiveValidForAid(Apiary.hives[aid.to]) || aid.amount <= 0 || hive.state !== hiveStates.economy) {
        delete this.aid[hiveName];
        continue;
      }
      hive.add(sCell.resTargetTerminal, aid.res, aid.amount);
    }
  }

  hiveValidForAid(hive: Hive) {
    return hive.cells.storage && hive.cells.storage.terminal && !hive.cells.defense.isBreached;
  }

  calcAmount(from: string, to: string, res: ResourceConstant) {
    let fromState = Apiary.hives[from].resState[res];
    let inProcess = this.aid[from] && this.aid[from].to === to && this.aid[from].res === res ? this.aid[from].amount : 0;
    if (fromState === undefined)
      fromState = inProcess;
    else
      fromState = fromState - PADDING_RESOURCE + inProcess;

    let toState = Apiary.hives[to].resState[res];
    if (toState === undefined)
      toState = 0;
    else
      toState = -toState + PADDING_RESOURCE;

    // help those in need
    if (res === RESOURCE_ENERGY && fromState < 10000 && toState - PADDING_RESOURCE > HIVE_ENERGY - PADDING_RESOURCE * 12
      && fromState + PADDING_RESOURCE > -(HIVE_ENERGY / 2))
      fromState = 10000;
    return Math.max(Math.min(toState, fromState), 0);
  }

  run() {
    let tryToBuyIn = Game.time % BUY_SHORTAGES_CYCLE === 1
      && (Apiary.broker.lastUpdated + MARKET_LAG >= Game.time || Game.cpu.getUsed() + Object.keys(Game.market.getAllOrders()).length * 0.005 < Game.cpu.tickLimit - 100);

    // to be able to save some cpu on buyIns

    for (let i = 0; i < this.nodes.length; ++i) {
      let hive = this.nodes[i];
      if (!hive.cells.storage || !hive.cells.storage.terminal)
        continue;
      let terminal = hive.cells.storage.terminal;
      let usedTerminal = false;

      if (tryToBuyIn) {
        for (const r in hive.shortages) {
          let res = <ResourceConstant>r;
          if (ALLOWED_TO_BUYIN.includes(res) && !(COMPRESS_MAP[<"H">res] && this.resState[COMPRESS_MAP[<"H">res]]! >= 100)) {
            let amount = hive.shortages[res]!;
            let ans = Apiary.broker.buyIn(terminal, res, amount + PADDING_RESOURCE / 2, hive.cells.storage.getUsedCapacity(res) <= LAB_BOOST_MINERAL * 2);
            if (ans === "short") {
              usedTerminal = true;
              break;
            }
          }
        }
        if (usedTerminal)
          continue;
      }

      let aid = this.aid[hive.roomName];
      if (aid && !terminal.cooldown) {
        let sCellTo = Apiary.hives[aid.to].cells.storage;
        let terminalTo = sCellTo && sCellTo.terminal;
        if (terminalTo) {
          let energyCost = Game.market.calcTransactionCost(10000, hive.roomName, aid.to) / 10000;
          let terminalEnergy = terminal.store.getUsedCapacity(RESOURCE_ENERGY);
          let energyCap = Math.floor(terminalEnergy / energyCost);
          let amount = Math.min(aid.amount, PADDING_RESOURCE, terminal.store.getUsedCapacity(aid.res), energyCap, terminalTo.store.getFreeCapacity(aid.res));

          if (aid.res === RESOURCE_ENERGY && amount * (1 + energyCost) > terminalEnergy)
            amount = Math.floor(amount * (1 - energyCost));

          if (amount > 0) {
            terminal.send(aid.res, amount, aid.to);
            if (Apiary.logger)
              Apiary.logger.newTerminalTransfer(terminal, terminalTo, amount, aid.res);
            continue;
          }
        }
      }

      if (tryToBuyIn) {
        for (const r in hive.mastersResTarget) {
          const res = <ResourceConstant>r;
          let balance = hive.mastersResTarget[res]! - hive.cells.storage.getUsedCapacity(res)
          if (balance > 0) {
            let ans = Apiary.broker.buyIn(terminal, res, balance, true);
            if (ans === "short") {
              usedTerminal = true;
              break;
            }
          }
        }
        if (usedTerminal)
          continue;
      }

      let stStore = hive.cells.storage.storage.store;
      if (tryToBuyIn && stStore.getUsedCapacity() > stStore.getCapacity() * 0.9 && hive.cells.storage.storage instanceof StructureStorage) {
        let keys = <(keyof ResTarget)[]>Object.keys(hive.resState);
        // keys = keys.filter(s => s !== RESOURCE_ENERGY)
        if (!keys.length)
          continue;
        let res = keys.reduce((prev, curr) => hive.resState[curr]! > hive.resState[prev]! ? curr : prev);
        if (hive.resState[res]! < 0)
          continue;
        Apiary.broker.sellOff(terminal, res, Math.min(1024, hive.resState[res]! * 0.8), stStore.getUsedCapacity() > stStore.getCapacity() * 0.98);
      }
    }
  }

  askAid(hive: Hive) {
    if (!this.hiveValidForAid(hive))
      return;
    hive.shortages = {};
    for (const r in hive.resState) {
      const res = <ResourceConstant>r;
      if (hive.resState[res]! < 0) {
        let validHives = _.filter(this.nodes, h => h.roomName !== hive.roomName && h.state === hiveStates.economy
          && this.calcAmount(h.roomName, hive.roomName, res) > PADDING_RESOURCE / 2).map(h => h.roomName);
        let sendCost = (h: string) => Game.market.calcTransactionCost(100000, hive.roomName, h) / 100000;
        if (res === RESOURCE_ENERGY)
          validHives = validHives.filter(h => sendCost(h) < 0.31); // 11 or less roomDist
        if (validHives.length) {
          let validHive = validHives.reduce((prev, curr) => hive.pos.getRoomRangeTo(curr) < hive.pos.getRoomRangeTo(prev) ? curr : prev);
          let amount = this.calcAmount(validHive, hive.roomName, res);
          if (this.aid[validHive] && this.aid[validHive].amount > amount)
            continue;
          this.aid[validHive] = {
            to: hive.roomName,
            res: res,
            amount: amount
          }
          break;
        } else
          hive.shortages[res] = -hive.resState[res]!;
      }
    }
  }

  updateState(hive: Hive) {
    hive.resState = { energy: 0 };
    if (!hive.cells.storage ||
      (hive.cells.storage.terminal && hive.cells.storage.terminal.effects
        && hive.cells.storage.terminal.effects.filter(e => e.effect === PWR_DISRUPT_TERMINAL)))
      return;

    let ress = Object.keys(hive.cells.storage.storage.store);
    if (hive.cells.storage.terminal)
      ress.concat(Object.keys(hive.cells.storage.terminal.store));

    if (hive.cells.lab) {
      for (const res in hive.cells.lab.resTarget) {
        if (ress.indexOf(res) === -1)
          ress.push(res);
        let amount = -hive.cells.lab.resTarget[<ResourceConstant>res]!;
        hive.add(hive.resState, res, amount);
      }
    }

    if (hive.cells.factory) {
      for (const res in hive.cells.factory.resTarget) {
        if (ress.indexOf(res) === -1)
          ress.push(res);
        let amount = -hive.cells.factory.resTarget[<ResourceConstant>res]!;
        hive.add(hive.resState, res, amount);
      }
    }

    for (const i in ress)
      hive.add(hive.resState, ress[i], hive.cells.storage.getUsedCapacity(<ResourceConstant>ress[i]));

    for (const res in hive.resTarget)
      hive.add(hive.resState, res, -hive.resTarget[<ResourceConstant>res]!);

    for (const res in hive.mastersResTarget)
      hive.add(hive.resState, res, -hive.mastersResTarget[<ResourceConstant>res]!);

    if (!hive.cells.storage.terminal)
      return;

    let fullStorage = Math.min(1, Math.floor(hive.cells.storage.getUsedCapacity(RESOURCE_ENERGY) / 1200) / 100 + 0.01);
    if (hive.cells.storage.getUsedCapacity(RESOURCE_ENERGY) < 150000)
      fullStorage = Math.max(fullStorage / 2, Math.min(fullStorage, hive.cells.storage.terminal.store.getUsedCapacity(RESOURCE_ENERGY) / TERMINAL_ENERGY));

    hive.cells.storage.resTargetTerminal = { energy: TERMINAL_ENERGY * fullStorage };
    if (hive.state !== hiveStates.battle) {
      let marketState = Apiary.broker.getTargetLongOrders(hive.roomName);
      for (const res in marketState)
        hive.add(hive.cells.storage.resTargetTerminal, res, Math.min(marketState[<ResourceConstant>res]!, 5000));
    }

    for (const res in hive.resState)
      hive.add(this.resState, res, hive.resState[<ResourceConstant>res]!);
  }
}
