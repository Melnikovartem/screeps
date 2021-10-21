import { hiveStates } from "../enums";

import { profile } from "../profiler/decorator";

import type{ Hive } from "../hive"

export const TERMINAL_ENERGY = Math.round(TERMINAL_CAPACITY * 0.1);
export type ResourceTarget = { [key in ResourceConstant]?: number };
const PADDING_RESOURCE = MAX_CREEP_SIZE * LAB_BOOST_MINERAL;

function add(dict: ResourceTarget, res: string, amount: number) {
  if (!dict[<ResourceConstant>res])
    dict[<ResourceConstant>res] = 0;
  dict[<ResourceConstant>res]! += amount;
}

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
      add(sCell.resTargetTerminal, aid.res, aid.amount);
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
      for (const r in hive.shortages)
        if (r.length === 1) {
          let res = <ResourceConstant>r;
          let amount = hive.shortages[res]!;
          let ans = Apiary.broker.buyIn(terminal, res, amount, hive.cells.storage.getUsedCapacity(res) <= LAB_BOOST_MINERAL * 2);
          if (ans === "short") {
            usedTerminal = true;
            break;
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
        let keys = <(keyof ResourceTarget)[]>Object.keys(hive.resState).filter(s => s !== RESOURCE_ENERGY);
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
    hive.shortages = { energy: 0 };
    if (!hive.cells.storage || !hive.cells.storage.terminal)
      return;

    let ress = Object.keys(hive.cells.storage.storage.store).concat(Object.keys(hive.cells.storage.terminal.store));
    if (hive.cells.lab)
      ress = ress.concat(Object.keys(hive.cells.lab.resTarget));

    for (const i in ress)
      if (!hive.resState[<ResourceConstant>ress[i]])
        add(hive.resState, ress[i], hive.cells.storage.getUsedCapacity(<ResourceConstant>ress[i]));

    if (hive.cells.lab)
      for (const res in hive.cells.lab.resTarget)
        add(hive.resState, res, -hive.cells.lab.resTarget[<ResourceConstant>res]!);

    for (const res in hive.resTarget)
      add(hive.resState, res, -hive.resTarget[<ResourceConstant>res]!);

    hive.cells.storage.resTargetTerminal = { energy: TERMINAL_ENERGY / (hive.cells.storage.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 50000 ? 3 : 1) };
    if (hive.state !== hiveStates.battle) {
      let marketState = Apiary.broker.getTargetLongOrders(hive.roomName);
      for (const res in marketState)
        add(hive.cells.storage.resTargetTerminal, res, Math.min(marketState[<ResourceConstant>res]!, 5000));
    }
  }

  /*
    run() {
      if (this.terminal && !this.terminal.cooldown) {
        let amountSend: number = 0;

        for (let resourceConstant in this.hive.resTarget) {
          let resource = <ResourceConstant>resourceConstant;
          let desire = this.hive.resTarget[resource]!;
          let balance = this.getUsedCapacity(resource) - desire;
          if (balance < 0) {
            let amount = -balance;
            let hurry = amount > desire * 0.9;
            if (hurry)
              amount = Math.floor(amount * 0.25);
            if (this.askAid(resource, amount, hurry))
              return;
          }
        }

        amountSend = 0;

        if (this.terminal.store.getFreeCapacity() > this.terminal.store.getCapacity() * 0.3)
          return;

        let res: ResourceConstant = RESOURCE_ENERGY;
        let amount: number = 0;
        for (let resourceConstant in this.terminal.store) {
          let resource = <ResourceConstant>resourceConstant;

          if (resource in this.hive.resTarget && this.getUsedCapacity(resource) <= this.hive.resTarget[resource]!)
            continue;

          let newAmount = this.terminal.store.getUsedCapacity(resource);
          if (resource === RESOURCE_ENERGY)
            newAmount -= this.terminalState.energy;
          if (newAmount > amount) {
            res = resource;
            amount = newAmount;
          }
        }

        amountSend = this.sendAid(res, amount);

        if (amountSend === 0)
          Apiary.broker.sellShort(this.terminal, res, amount);
      }
    }




    askAid(res: ResourceConstant, amount: number, hurry?: boolean) {
      if (!this.terminal)
        return 0;
      let hives = _.filter(Apiary.hives, h => h.roomName != this.hive.roomName
        && h.cells.storage && h.cells.storage.terminal
        && (!(res in h.resTarget) || h.cells.storage.storage.store.getUsedCapacity(res) > h.resTarget[res]!));

      if (!hives.length) {
        if (res === RESOURCE_ENERGY)
          return 0;
        let ans = Apiary.broker.buyIn(this.terminal, res, amount, hurry);
        if (ans === "short")
          return amount;
        return 0;
      }

      let closest = hives.reduce((prev, curr) => this.pos.getRoomRangeTo(prev) > this.pos.getRoomRangeTo(curr) ? curr : prev);
      let sCell = closest.cells.storage!;
      if (!sCell.requests[STRUCTURE_TERMINAL + "_" + sCell.terminal!.id]) {
        let deiseredIn = closest.resTarget[res] ? closest.resTarget[res]! : 0;
        sCell.requestFromStorage([sCell.terminal!], 5, res, sCell.storage.store.getUsedCapacity(res) - deiseredIn, true);
      }

      return 0;
    }

    sendAid(res: ResourceConstant, amount: number) {
      if (!this.terminal)
        return 0;
      let hives = _.filter(Apiary.hives, h => h.roomName != this.hive.roomName
        && h.cells.storage && h.cells.storage.terminal
        && res in h.resTarget && h.cells.storage.storage.store.getUsedCapacity(res) < h.resTarget[res]!);

      if (!hives.length)
        return 0;

      let amoundSend: number = 0;
      let closest = hives.reduce((prev, curr) => this.pos.getRoomRangeTo(prev) > this.pos.getRoomRangeTo(curr) ? curr : prev);
      let terminalTo = closest.cells.storage! && closest.cells.storage!.terminal!;
      amoundSend = Math.min(amount, terminalTo.store.getFreeCapacity(res));

      let energyCost = Game.market.calcTransactionCost(10000, this.pos.roomName, terminalTo.pos.roomName) / 10000;
      let energyCap = Math.floor(this.terminal.store.getUsedCapacity(RESOURCE_ENERGY) / energyCost);
      amoundSend = Math.min(amoundSend, energyCap);

      if (res === RESOURCE_ENERGY && amoundSend * (1 + energyCost) > this.terminal.store.getUsedCapacity(RESOURCE_ENERGY))
        amoundSend = Math.floor(amoundSend * (1 - energyCost));

      let ans = this.terminal.send(res, amoundSend, terminalTo.pos.roomName);
      if (ans === OK && Apiary.logger)
        Apiary.logger.newTerminalTransfer(this.terminal, terminalTo, amoundSend, res);

      return amoundSend;
    }
    */
}
