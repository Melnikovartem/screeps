import { hiveStates } from "../enums";

import { profile } from "../profiler/decorator";
import { TERMINAL_ENERGY } from "../cells/stage1/storageCell";
import { BASE_MINERALS } from "../cells/stage1/laboratoryCell";
//  import { COMPRESS_MAP } from "../cells/stage1/factoryCell"; COMMODITIES_TO_SELL

import type { Hive, ResTarget } from "../hive";

const PADDING_RESOURCE = MAX_CREEP_SIZE * LAB_BOOST_MINERAL;
const FREE_CAPACITY = STORAGE_CAPACITY * 0.1

@profile
export class Network {
  nodes: Hive[] = [];
  aid: { [hiveNameFrom: string]: { to: string, res: ResourceConstant, amount: number, excess?: number } } = {} // from -> to
  resState: ResTarget = {};

  init() {
    this.nodes = _.filter(Apiary.hives, h => h.cells.storage && h.cells.storage.terminal);
    _.forEach(this.nodes, node => {
      Apiary.broker.shortOrdersSell[node.roomName] = { orders: {}, lastUpdated: Game.time };
    });
  }

  update() {
    this.resState = {};
    _.forEach(Apiary.hives, hive => this.updateState(hive));

    if (Game.time !== Apiary.createTime)
      for (let i = 0; i < this.nodes.length; ++i)
        this.askAid(this.nodes[i]);

    for (const hiveName in this.aid) {
      let hive = Apiary.hives[hiveName];
      let sCell = hive.cells.storage;
      if (!sCell)
        continue;
      let aid = this.aid[hiveName];
      if (!aid.excess)
        aid.amount = this.calcAmount(hiveName, aid.to, aid.res);
      if (!this.hiveValidForAid(Apiary.hives[aid.to]) || aid.amount <= 0 || hive.state !== hiveStates.economy) {
        delete this.aid[hiveName];
        continue;
      }
      hive.add(sCell.resTargetTerminal, aid.res, aid.amount);
    }
  }

  hiveValidForAid(hive: Hive) {
    let sCell = hive.cells.storage;
    return sCell && sCell.terminal && !hive.cells.defense.isBreached && !(sCell.terminal.effects && sCell.terminal.effects.filter(e => e.effect === PWR_DISRUPT_TERMINAL));
  }

  calcAmount(from: string, to: string, res: ResourceConstant) {
    let fromState = Apiary.hives[from].resState[res];
    let inProcess = this.aid[from] && this.aid[from].to === to && this.aid[from].res === res ? this.aid[from].amount : 0;
    let padding = 0;

    if (res === RESOURCE_ENERGY)
      padding = PADDING_RESOURCE;

    if (fromState === undefined)
      fromState = inProcess;
    else
      fromState = fromState - padding + inProcess;

    let toState = Apiary.hives[to].resState[res];
    if (toState === undefined)
      toState = 0;
    else
      toState = -toState + padding;

    return Math.max(Math.min(toState, fromState, 50000), 0);
  }

  run() {
    // to be able to save some cpu on buyIns

    for (let i = 0; i < this.nodes.length; ++i) {
      let hive = this.nodes[i];
      if (!hive.cells.storage || !hive.cells.storage.terminal)
        continue;
      let terminal = hive.cells.storage.terminal;
      let usedTerminal = false;

      for (const r in hive.shortages) {
        let res = <ResourceConstant>r;
        let canBuyIn = 0;
        switch (hive.shouldDo("buyIn")) {
          case 3:
            canBuyIn = 1;
            break;
          case 2:
            if (res === RESOURCE_ENERGY || res === RESOURCE_OPS)
              canBuyIn = 1;
          case 1:
            if (BASE_MINERALS.includes(res))
              canBuyIn = 1;
          case 0:
        }
        if (canBuyIn) {
          let amount = hive.shortages[res]!;
          let ans = Apiary.broker.buyIn(terminal, res, amount + PADDING_RESOURCE, hive.cells.storage.getUsedCapacity(res) <= LAB_BOOST_MINERAL * 2);
          if (ans === "short") {
            usedTerminal = true;
            break;
          }
        }
      }
      if (usedTerminal)
        continue;

      let aid = this.aid[hive.roomName];
      if (aid && !terminal.cooldown) {
        let sCellTo = Apiary.hives[aid.to].cells.storage;
        let terminalTo = sCellTo && sCellTo.terminal;
        if (terminalTo) {
          let energyCost = Game.market.calcTransactionCost(10000, hive.roomName, aid.to) / 10000;
          let terminalEnergy = terminal.store.getUsedCapacity(RESOURCE_ENERGY);
          let energyCap = Math.floor(terminalEnergy / energyCost);
          let amount = Math.min(aid.amount, terminal.store.getUsedCapacity(aid.res), energyCap, terminalTo.store.getFreeCapacity(aid.res));

          if (aid.res === RESOURCE_ENERGY && amount * (1 + energyCost) > terminalEnergy)
            amount = Math.floor(amount * (1 - energyCost));

          if (amount > 0) {
            let ans = terminal.send(aid.res, amount, aid.to);
            if (ans === OK) {
              if (Apiary.logger)
                Apiary.logger.newTerminalTransfer(terminal, terminalTo, amount, aid.res);
              if (aid.excess)
                aid.amount -= amount;
            }
            continue;
          }
        }
      }

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

      let stStore = hive.cells.storage.storage.store;
      if (stStore.getFreeCapacity() < FREE_CAPACITY * 0.5 && hive.cells.storage.storage instanceof StructureStorage) {
        let keys = <(keyof ResTarget)[]>Object.keys(hive.resState);
        if (!keys.length)
          continue;
        let res = keys.reduce((prev, curr) => hive.resState[curr]! > hive.resState[prev]! ? curr : prev);
        if (hive.resState[res]! < 0)
          continue;
        if (hive.shouldDo("sellOff"))
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
          && this.calcAmount(h.roomName, hive.roomName, res) > 0).map(h => h.roomName);
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

    if (hive.cells.storage && hive.cells.storage.storage.store.getFreeCapacity() < FREE_CAPACITY && !this.aid[hive.roomName]) {
      let emptyHive = _.filter(this.nodes, h => h.roomName !== hive.roomName && h.cells.storage
        && h.cells.storage.storage.store.getFreeCapacity() > FREE_CAPACITY * 1.5)[0];
      if (emptyHive) {
        let keys = <(keyof ResTarget)[]>Object.keys(hive.resState);
        if (keys.length) {
          let res = keys.reduce((prev, curr) => hive.resState[curr]! > hive.resState[prev]! ? curr : prev);
          if (hive.resState[res]! > 0)
            this.aid[hive.roomName] = {
              to: emptyHive.roomName,
              res: res,
              amount: FREE_CAPACITY * 0.1,
              excess: 1,
            }
        }
      }
    }
  }

  updateState(hive: Hive) {
    hive.resState = { energy: 0 };
    let sCell = hive.cells.storage;
    if (!sCell)
      return;

    let ress = Object.keys(sCell.storage.store);
    if (sCell.terminal && !(sCell.terminal.effects && sCell.terminal.effects.filter(e => e.effect === PWR_DISRUPT_TERMINAL)))
      for (const res in sCell.terminal.store)
        if (ress.indexOf(res) === -1)
          ress.push(res);

    if (hive.cells.lab) {
      for (const res in hive.cells.lab.resTarget) {
        if (ress.indexOf(res) === -1)
          ress.push(res);
        let amount = -hive.cells.lab.resTarget[<ResourceConstant>res]!;
        hive.add(hive.resState, res, amount);
      }
      if (hive.cells.lab.prod) {
        if (ress.indexOf(hive.cells.lab.prod.res1) === -1)
          ress.push(hive.cells.lab.prod.res1);
        if (ress.indexOf(hive.cells.lab.prod.res2) === -1)
          ress.push(hive.cells.lab.prod.res2);
        hive.add(hive.resState, hive.cells.lab.prod.res1, -hive.cells.lab.prod.plan);
        hive.add(hive.resState, hive.cells.lab.prod.res2, -hive.cells.lab.prod.plan);
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
      hive.add(hive.resState, ress[i], sCell.getUsedCapacity(<ResourceConstant>ress[i]));

    for (const res in hive.resTarget)
      hive.add(hive.resState, res, -hive.resTarget[<ResourceConstant>res]!);

    for (const res in hive.mastersResTarget)
      hive.add(hive.resState, res, -hive.mastersResTarget[<ResourceConstant>res]!);

    if (!sCell.terminal)
      return;

    let fullStorage = Math.min(1, Math.floor(sCell.getUsedCapacity(RESOURCE_ENERGY) / 1200) / 100 + 0.01);
    if (sCell.getUsedCapacity(RESOURCE_ENERGY) < 150000)
      fullStorage = Math.max(fullStorage / 2, Math.min(fullStorage, sCell.terminal.store.getUsedCapacity(RESOURCE_ENERGY) / TERMINAL_ENERGY));

    sCell.resTargetTerminal = { energy: TERMINAL_ENERGY * fullStorage };

    if (hive.state !== hiveStates.battle) {
      let marketState = Apiary.broker.getTargetLongOrders(hive.roomName);
      for (const res in marketState)
        hive.add(sCell.resTargetTerminal, res, Math.min(marketState[<ResourceConstant>res]!, 5000));
    }

    let aid = this.aid[hive.roomName];
    if (aid)
      hive.add(sCell.resTargetTerminal, aid.res, aid.amount);

    for (const res in hive.resState)
      hive.add(this.resState, res, hive.resState[<ResourceConstant>res]!);
  }
}
