import { hiveStates } from "../enums";

import { profile } from "../profiler/decorator";

export const TERMINAL_ENERGY = Math.round(TERMINAL_CAPACITY * 0.1);
export type ResourceTarget = { [key in ResourceConstant]?: number };
const PADDING_RESOURCE = 5000;

@profile
export class Network {
  state: { [hiveName: string]: ResourceTarget } = {}
  aid: { [hiveNameFrom: string]: { to: string, res: ResourceConstant, amount: number } } = {} // from -> to
  shortages: { [hiveNameFrom: string]: ResourceTarget } = {}

  update() {
    for (const hiveName in Apiary.hives)
      this.updateState(hiveName);

    this.shortages = {};
    for (const hiveName in this.state)
      this.reactToState(hiveName);

    for (const hiveName in this.aid) {
      let hive = Apiary.hives[hiveName];
      let sCell = hive.cells.storage;
      if (!sCell)
        continue;
      let aid = this.aid[hiveName];
      aid.amount = this.calcAmount(hiveName, aid.to, aid.res);
      if (aid.amount === 0 || hive.state !== hiveStates.economy) {
        delete this.aid[hiveName];
        continue;
      }
      if (!sCell.resTargetTerminal[aid.res])
        sCell.resTargetTerminal[aid.res] = 0;
      sCell.resTargetTerminal[aid.res]! += aid.amount;
    }
  }

  calcAmount(from: string, to: string, res: ResourceConstant) {
    let fromState = this.state[from][res];
    if (fromState === undefined)
      fromState = 0;

    let toState = this.state[to][res];
    if (toState === undefined)
      toState = 0;
    toState = -toState;
    return Math.max(Math.min(toState + PADDING_RESOURCE / 2, fromState - PADDING_RESOURCE / 2), 0);
  }

  run() {
    for (const hiveName in this.state) {
      let hive = Apiary.hives[hiveName];
      if (!hive.cells.storage || !hive.cells.storage.terminal)
        continue;
      let terminal = hive.cells.storage.terminal;
      let state = this.state[hiveName];

      let usedTerminal = false;
      let shortages = this.shortages[hiveName];
      for (const r in shortages) {
        let res = <ResourceConstant>r;
        if (r.length === 1) {
          let ans = Apiary.broker.buyIn(terminal, res, shortages[res]!);
          if (ans === "short") {
            usedTerminal = true;
            break;
          }
        }
      }
      if (usedTerminal)
        continue;

      let aid = this.aid[hiveName];
      if (aid && !terminal.cooldown) {
        let energyCost = Game.market.calcTransactionCost(10000, hiveName, aid.to) / 10000;
        let terminalEnergy = terminal.store.getUsedCapacity(RESOURCE_ENERGY);
        let energyCap = Math.floor(terminalEnergy / energyCost);
        if (aid.res === RESOURCE_ENERGY)
          terminalEnergy -= TERMINAL_ENERGY;

        let amount = Math.min(aid.amount, PADDING_RESOURCE, terminal.store.getUsedCapacity(aid.res), energyCap);

        if (amount > 0) {
          terminal.send(aid.res, amount, aid.to);
          continue;
        }
      }

      let stStore = hive.cells.storage.storage.store;
      if (stStore.getUsedCapacity() > stStore.getCapacity() * 0.75) {
        let keys = <(keyof ResourceTarget)[]>Object.keys(state).filter(s => s !== RESOURCE_ENERGY);
        if (!keys.length)
          continue;
        let res = keys.reduce((prev, curr) => state[curr]! > state[prev]! ? curr : prev);
        if (state[res]! < 0)
          continue;
        Apiary.broker.sellOff(terminal, res, Math.min(2048, state[res]! * 0.8), stStore.getUsedCapacity() > stStore.getCapacity() * 0.98);
      }
    }
  }

  reactToState(hiveName: string) {
    let state = this.state[hiveName];
    for (const r in state) {
      const res = <ResourceConstant>r;
      if (state[res]! < 0) {
        let validHives = _.filter(Object.keys(this.state), hiveNameCheck => hiveNameCheck !== hiveName && this.state[hiveNameCheck][res]! > PADDING_RESOURCE && Apiary.hives[hiveNameCheck].state === hiveStates.economy);
        let sendCost = (h: string) => Game.market.calcTransactionCost(100000, hiveName, h) / 100000;
        if (res === RESOURCE_ENERGY)
          validHives = validHives.filter(h => sendCost(h) <= 0.5);
        if (validHives.length) {
          let validHive = validHives.reduce((prev, curr) => sendCost(curr) < sendCost(prev) ? curr : prev);
          let amount = this.calcAmount(validHive, hiveName, res);
          if (this.aid[validHive] && this.aid[validHive].amount > amount)
            continue;
          this.aid[validHive] = {
            to: hiveName,
            res: res,
            amount: amount
          }
          break;
        } else {
          if (!this.shortages[hiveName])
            this.shortages[hiveName] = {};
          this.shortages[hiveName][res] = -state[res]!;
        }
      }
    }
  }

  updateState(hiveName: string) {
    let hive = Apiary.hives[hiveName];
    if (!hive.cells.storage || !hive.cells.storage.terminal)
      return;
    this.state[hiveName] = {}
    let sate = this.state[hiveName];

    let ress = Object.keys(hive.cells.storage.storage.store).concat(Object.keys(hive.cells.storage.terminal.store));
    if (hive.cells.lab)
      ress = ress.concat(Object.keys(hive.cells.lab.resTarget));

    for (const i in ress) {
      const res = <ResourceConstant>ress[i];
      if (!sate[res])
        sate[res] = hive.cells.storage.getUsedCapacity(res);
    }

    if (hive.cells.lab)
      for (const r in hive.cells.lab.resTarget) {
        const res = <ResourceConstant>r;
        if (!sate[res])
          sate[res] = 0;
        sate[res]! -= hive.cells.lab.resTarget[res]!;
      }

    for (const r in hive.resTarget) {
      const res = <ResourceConstant>r;
      if (!sate[res])
        sate[res] = 0;
      sate[res]! -= hive.resTarget[res]!;
    }

    hive.cells.storage.resTargetTerminal = { energy: TERMINAL_ENERGY / (hive.cells.storage.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 50000 ? 3 : 1) };
    let tState = hive.cells.storage.resTargetTerminal;
    if (hive.state !== hiveStates.battle) {
      let marketState = Apiary.broker.getTargetLongOrders(hiveName);
      for (const r in marketState) {
        const res = <ResourceConstant>r;
        if (!tState[res])
          tState[res] = 0;
        tState[res]! += Math.min(marketState[res]!, 5000);
      }
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
