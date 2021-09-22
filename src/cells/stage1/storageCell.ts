import { Cell } from "../_Cell";
import { ManagerMaster } from "../../beeMasters/economy/manager";

import { profile } from "../../profiler/decorator";
import type { Hive } from "../../Hive";

export interface StorageRequest {
  ref: string;
  from: StructureLink | StructureTerminal | StructureStorage | StructureLab;
  to: StructureLink | StructureTerminal | StructureStorage | StructureTower | StructureLab | StructurePowerSpawn | StructureExtension | StructureSpawn;
  resource: ResourceConstant;
  amount: number;
  priority: 0 | 1 | 2 | 3 | 4 | 5;
}

export const TERMINAL_ENERGY = Math.round(TERMINAL_CAPACITY * 0.2);
type StorageResource = RESOURCE_ENERGY
export const STORAGE_BALANCE: { [key in StorageResource]: number } = {
  [RESOURCE_ENERGY]: Math.round(STORAGE_CAPACITY * 0.4),
};

@profile
export class StorageCell extends Cell {

  storage: StructureStorage;
  links: { [id: string]: StructureLink } = {};
  linksState: { [id: string]: "idle" | "busy" } = {};
  terminal: StructureTerminal | undefined;
  master: ManagerMaster;

  requests: { [id: string]: StorageRequest } = {};

  constructor(hive: Hive, storage: StructureStorage) {
    super(hive, "StorageCell_" + hive.room.name);

    this.storage = storage;

    let links = <StructureLink[]>_.filter(this.storage.pos.findInRange(FIND_MY_STRUCTURES, 2),
      (structure) => structure.structureType === STRUCTURE_LINK);

    _.forEach(links, (l) => {
      this.links[l.id] = l;
      this.linksState[l.id] = "idle";
    });

    this.terminal = <StructureTerminal>_.filter(this.storage.pos.findInRange(FIND_MY_STRUCTURES, 2),
      (structure) => structure.structureType === STRUCTURE_TERMINAL)[0];

    this.pos = this.hive.getPos("storage");
    this.master = new ManagerMaster(this);
  }

  requestFromStorage(ref: string, to: StorageRequest["to"], priority: StorageRequest["priority"]
    , res: StorageRequest["resource"] = RESOURCE_ENERGY, amount: number = Infinity): number {
    if (this.master.manager && this.master.manager.target == ref)
      return 0;
    if (amount === Infinity)
      amount = (<Store<ResourceConstant, false>>to.store).getFreeCapacity(res);
    amount = Math.min(amount, this.storage.store.getUsedCapacity(res));
    if (amount > 0)
      this.requests[ref] = {
        ref: ref,
        from: this.storage,
        to: to,
        resource: res,
        priority: priority,
        amount: amount,
      };
    return amount;
  }

  requestToStorage(ref: string, from: StorageRequest["from"], priority: StorageRequest["priority"]
    , res: StorageRequest["resource"] = RESOURCE_ENERGY, amount: number = Infinity): number {
    if (this.master.manager && this.master.manager.target == ref)
      return 0;
    if (amount === Infinity)
      amount = (<Store<ResourceConstant, false>>from.store).getUsedCapacity(res);
    amount = Math.min(amount, this.storage.store.getFreeCapacity(res));
    if (amount > 0)
      this.requests[ref] = {
        ref: ref,
        from: from,
        to: this.storage,
        resource: res,
        priority: priority,
        amount: amount,
      };
    return amount;
  }

  getFreeLink(sendIn: boolean = false): StructureLink | undefined {
    let links = _.filter(this.links, (l) => !sendIn || this.linksState[l.id] === "idle").sort(
      (a, b) => (b.store.getUsedCapacity(RESOURCE_ENERGY) - a.store.getUsedCapacity(RESOURCE_ENERGY)) * (sendIn ? -1 : 1));
    if (sendIn || !links.length)
      return links[0];
    else
      return links.reduce((prev, curr) => curr.cooldown < prev.cooldown ? curr : prev);
  }

  update() {
    super.update(["links"]);

    if (!this.storage) {
      Apiary.destroyTime = Game.time;
      return;
    }

    for (let k in this.requests) {
      let from = <StorageRequest["from"] | null>Game.getObjectById(this.requests[k].from.id);
      if (from)
        this.requests[k].from = from;
      let to = <StorageRequest["to"] | null>Game.getObjectById(this.requests[k].to.id);
      if (to)
        this.requests[k].to = to;
    }

    if ((!Object.keys(this.requests).length || this.storage.store.getFreeCapacity() < 10000) && this.terminal) {
      if (this.terminal.store.getFreeCapacity() > this.terminal.store.getCapacity() * 0.1) {
        let freeCap = this.storage.store.getCapacity() * 0.8 - this.storage.store.getUsedCapacity();
        let res: ResourceConstant = RESOURCE_ENERGY;
        let amount = this.terminal.store.getUsedCapacity(RESOURCE_ENERGY) - TERMINAL_ENERGY;
        if (amount >= 0) {
          amount = 0;
          // target amount in storage [80% - 9900, 80%]
          if (freeCap > 9900)
            for (let resourceConstant in this.terminal.store) {
              let resource = <ResourceConstant>resourceConstant;
              let newAmount = this.terminal.store.getUsedCapacity(resource);
              if (resource === RESOURCE_ENERGY)
                newAmount -= TERMINAL_ENERGY;
              if (newAmount < amount || !amount && newAmount > 0) {
                res = resource;
                amount = newAmount;
              }
            }
          else if (freeCap < 0) {
            for (let resourceConstant in this.storage.store) {
              let resource = <ResourceConstant>resourceConstant;
              let newAmount = this.storage.store.getUsedCapacity(resource);
              if (resource === RESOURCE_ENERGY)
                newAmount -= STORAGE_BALANCE[RESOURCE_ENERGY]!; // save 400K energy everytime
              if (-amount < newAmount) {
                res = resource;
                amount = -newAmount;
              }
            }
            amount = Math.max(amount, freeCap);
          }
        } else if (this.storage.store.getUsedCapacity(res) < STORAGE_BALANCE[RESOURCE_ENERGY]!)
          amount = 0;

        if (amount > 0)
          this.requestToStorage("terminal_" + this.terminal.id, this.terminal,
            this.storage.store.getFreeCapacity() < 10000 ? 2 : 5, res, Math.min(amount, 5500, freeCap));
        else if (amount < 0)
          this.requestFromStorage("terminal_" + this.terminal.id, this.terminal, 5, res, Math.min(-amount, 5500));
      }
    }

    for (let id in this.links) {
      let link = this.links[id];
      this.linksState[id] = "idle";
      if (!this.requests["link_" + link.id] && link.store.getUsedCapacity(RESOURCE_ENERGY) > LINK_CAPACITY * 0.5)
        this.requestToStorage("link_" + link.id, link, 3);
    }

    this.hive.stateChange("lowenergy", this.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 50000);
  }

  run() {
    for (let k in this.requests) {
      let request = this.requests[k];
      if (request.amount > 0 && !(<Store<ResourceConstant, false>>request.from.store).getUsedCapacity(request.resource)
        && !(this.master.manager && this.master.manager.store.getUsedCapacity(request.resource)))
        delete this.requests[k];
      else if (!(<Store<ResourceConstant, false>>request.to.store).getFreeCapacity(request.resource))
        delete this.requests[k];
      else if (request.amount <= 0)
        delete this.requests[k];
    }

    if (this.terminal && this.terminal.store.getUsedCapacity() > this.terminal.store.getCapacity() * 0.7 && !this.terminal.cooldown) {
      let res: ResourceConstant = RESOURCE_ENERGY;
      let amount: number = 0;
      for (let resourceConstant in this.terminal.store) {
        let resource = <ResourceConstant>resourceConstant;
        let newAmount = this.terminal.store.getUsedCapacity(resource);
        if (resource === RESOURCE_ENERGY)
          newAmount -= TERMINAL_ENERGY;
        if (newAmount > amount) {
          res = resource;
          amount = newAmount;
        }
      }

      let amoundSend: number = 0;
      if (res in STORAGE_BALANCE)
        amoundSend = this.sendAid(<StorageResource>res, amount);

      if (amoundSend === 0 && Apiary.useBucket)
        this.sellOff(res, amount);
    }
  }

  sellOff(res: ResourceConstant, amount: number) {
    if (!this.terminal)
      return 0;
    let targetPrice = -1;
    let orders = Game.market.getAllOrders((order) => {
      if (order.type === ORDER_SELL || order.resourceType !== res)
        return false;
      if (targetPrice < order.price)
        targetPrice = order.price;
      return this.terminal!.pos.getRoomRangeTo(order.roomName!) < 25;
    });
    if (orders.length)
      orders = orders.filter((order) => order.price > targetPrice * 0.9);
    if (orders.length) {
      let order = orders.reduce((prev, curr) => curr.price > prev.price ? curr : prev);
      let energyCost = Game.market.calcTransactionCost(10000, this.hive.roomName, order.roomName!) / 10000;
      let energyCap = Math.floor(this.terminal.store.getUsedCapacity(RESOURCE_ENERGY) / energyCost);
      amount = Math.min(amount, energyCap, order.amount);
      if (orders[0].resourceType === RESOURCE_ENERGY && amount * (1 + energyCost) > this.terminal.store.getUsedCapacity(RESOURCE_ENERGY))
        amount = Math.floor(amount * (1 - energyCost));
      let ans = Game.market.deal(orders[0].id, amount, this.hive.roomName);
      if (ans === OK) {
        if (Apiary.logger)
          Apiary.logger.newMarketOperation(order, amount, this.hive.roomName);
        return amount;
      }
    }
    return 0;
  }

  sendAid(res: StorageResource, amount: number) {
    let amoundSend: number = 0;
    if (!this.terminal)
      return amoundSend;
    let hives = _.filter(Apiary.hives, (h) => h.roomName != this.hive.roomName && h.cells.storage && h.cells.storage.terminal
      && h.cells.storage.storage.store.getUsedCapacity(RESOURCE_ENERGY) < STORAGE_BALANCE[res])
    if (hives.length) {
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
    }
    return amoundSend;
  }
}
