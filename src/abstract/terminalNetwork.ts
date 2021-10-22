import { hiveStates } from "../enums";

import { profile } from "../profiler/decorator";

import type { Hive, ResTarget } from "../hive"

export const TERMINAL_ENERGY = Math.round(TERMINAL_CAPACITY * 0.1);
const PADDING_RESOURCE = MAX_CREEP_SIZE * LAB_BOOST_MINERAL;

const ALLOWED_TO_BUYIN: ResourceConstant[] = ["H", "K", "L", "U"]; //"X", "O", "Z"];

@profile
export class Network {
  nodes: Hive[] = [];
  aid: { [hiveNameFrom: string]: { to: string, res: ResourceConstant, amount: number } } = {} // from -> to

  constructor(hives?: { [id: string]: Hive }) {
    if (!hives)
      return;
    this.nodes = _.filter(hives, h => h.cells.storage && h.cells.storage.terminal);
  }

  update() {
    for (let i = 0; i < this.nodes.length; ++i)
      this.updateState(this.nodes[i]);

    for (let i = 0; i < this.nodes.length; ++i)
      this.reactToState(this.nodes[i]);

    for (const hiveName in this.aid) {
      let hive = Apiary.hives[hiveName];
      let sCell = hive.cells.storage;
      if (!sCell)
        continue;
      let aid = this.aid[hiveName];
      aid.amount = this.calcAmount(hiveName, aid.to, aid.res);
      if (aid.amount <= 0 || hive.state !== hiveStates.economy) {
        delete this.aid[hiveName];
        continue;
      }
      hive.add(sCell.resTargetTerminal, aid.res, aid.amount);
    }
  }

  calcAmount(from: string, to: string, res: ResourceConstant) {
    let fromState = Apiary.hives[from].resState[res];
    if (fromState === undefined)
      fromState = 0;
    else
      fromState = fromState - PADDING_RESOURCE;

    let toState = Apiary.hives[to].resState[res];
    if (toState === undefined)
      toState = 0;
    else
      toState = -toState + PADDING_RESOURCE;
    return Math.max(Math.min(toState, fromState), 0);
  }

  run() {
    for (let i = 0; i < this.nodes.length; ++i) {
      let hive = this.nodes[i];
      if (!hive.cells.storage || !hive.cells.storage.terminal)
        continue;
      let terminal = hive.cells.storage.terminal;
      let usedTerminal = false;
      for (const r in hive.shortages) {
        let res = <ResourceConstant>r;
        if (ALLOWED_TO_BUYIN.includes(res)) {
          let amount = hive.shortages[res]!;
          let ans = Apiary.broker.buyIn(terminal, res, amount, hive.cells.storage.getUsedCapacity(res) <= LAB_BOOST_MINERAL * 2);
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
        let energyCost = Game.market.calcTransactionCost(10000, hive.roomName, aid.to) / 10000;
        let terminalEnergy = terminal.store.getUsedCapacity(RESOURCE_ENERGY);
        let energyCap = Math.floor(terminalEnergy / energyCost);
        let amount = Math.min(aid.amount, PADDING_RESOURCE, terminal.store.getUsedCapacity(aid.res), energyCap);

        if (aid.res === RESOURCE_ENERGY && amount * (1 + energyCost) > terminalEnergy)
          amount = Math.floor(amount * (1 - energyCost));

        if (amount > 0) {
          terminal.send(aid.res, amount, aid.to);
          continue;
        }
      }

      let stStore = hive.cells.storage.storage.store;
      if (stStore.getUsedCapacity() > stStore.getCapacity() * 0.75) {
        let keys = <(keyof ResTarget)[]>Object.keys(hive.resState).filter(s => s !== RESOURCE_ENERGY);
        if (!keys.length)
          continue;
        let res = keys.reduce((prev, curr) => hive.resState[curr]! > hive.resState[prev]! ? curr : prev);
        if (hive.resState[res]! < 0)
          continue;
        Apiary.broker.sellOff(terminal, res, Math.min(2048, hive.resState[res]! * 0.8), stStore.getUsedCapacity() > stStore.getCapacity() * 0.98);
      }
    }
  }

  reactToState(hive: Hive) {
    for (const r in hive.resState) {
      const res = <ResourceConstant>r;
      if (hive.resState[res]! < 0) {
        let validHives = _.filter(this.nodes, h => h.roomName !== hive.roomName && h.resState[res]! > PADDING_RESOURCE && h.state === hiveStates.economy).map(h => h.roomName);
        let sendCost = (h: string) => Game.market.calcTransactionCost(100000, hive.roomName, h) / 100000;
        if (res === RESOURCE_ENERGY)
          validHives = validHives.filter(h => sendCost(h) <= 0.5);
        if (validHives.length) {
          let validHive = validHives.reduce((prev, curr) => sendCost(curr) < sendCost(prev) ? curr : prev);
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
    hive.shortages = {};
    if (!hive.cells.storage || !hive.cells.storage.terminal)
      return;

    let ress = Object.keys(hive.cells.storage.storage.store).concat(Object.keys(hive.cells.storage.terminal.store));
    if (hive.cells.lab)
      ress = ress.concat(Object.keys(hive.cells.lab.resTarget));

    for (const i in ress)
      if (!hive.resState[<ResourceConstant>ress[i]])
        hive.add(hive.resState, ress[i], hive.cells.storage.getUsedCapacity(<ResourceConstant>ress[i]));

    if (hive.cells.lab)
      for (const res in hive.cells.lab.resTarget) {
        let amount = -hive.cells.lab.resTarget[<ResourceConstant>res]! / 2;
        // so we dont move when there are still enough minerals
        hive.add(hive.resState, res, amount);
        if (hive.resState[<ResourceConstant>res]! < 0)
          hive.add(hive.resState, res, amount);
      }

    for (const res in hive.resTarget)
      hive.add(hive.resState, res, -hive.resTarget[<ResourceConstant>res]!);

    for (const res in hive.mastersResTarget)
      hive.add(hive.resState, res, -hive.mastersResTarget[<ResourceConstant>res]!);

    hive.cells.storage.resTargetTerminal = { energy: TERMINAL_ENERGY / (hive.cells.storage.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 50000 ? 3 : 1) };
    if (hive.state !== hiveStates.battle) {
      let marketState = Apiary.broker.getTargetLongOrders(hive.roomName);
      for (const res in marketState)
        hive.add(hive.cells.storage.resTargetTerminal, res, Math.min(marketState[<ResourceConstant>res]!, 5000));
    }
  }
}
