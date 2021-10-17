import { profile } from "../profiler/decorator";

export const TERMINAL_ENERGY = Math.round(TERMINAL_CAPACITY * 0.2);

@profile
export class Network {
  state: { [hiveName: string]: { [key in ResourceConstant]?: number } } = {}

  update() {
    for (const hiveName in Apiary.hives) {
      let hive = Apiary.hives[hiveName];
      if (!hive.cells.storage || !hive.cells.storage.terminal)
        return;
      this.state[hiveName] = {}
      let sate = this.state[hiveName];

      let ress = Object.keys(hive.cells.storage.storage.store).concat(Object.keys(hive.cells.storage.terminal.store));
      if (hive.cells.lab)
        ress = ress.concat(Object.keys(hive.cells.lab.resTarget));

      for (const r in ress) {
        const res = <ResourceConstant>r;
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

      hive.cells.storage.resTargetTerminal = { energy: TERMINAL_ENERGY };
      let tState = hive.cells.storage.resTargetTerminal;

      let marketState = Apiary.broker.getTargetLongOrders(hiveName);
      for (const r in marketState) {
        const res = <ResourceConstant>r;
        if (!tState[res])
          tState[res] = 0;
        tState[res]! += marketState[res]!;
      }

      // toDoAddAidSystem
    }
  }

  run() {

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
