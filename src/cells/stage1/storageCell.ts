import { Cell } from "../_Cell";
import { Hive } from "../../Hive";

import { managerMaster } from "../../beeMasters/economy/manager";
import { profile } from "../../profiler/decorator";

export interface StorageRequest {
  ref: string;
  from: StructureLink | StructureTerminal | StructureStorage | StructureLab;
  to: StructureLink | StructureTerminal | StructureStorage | StructureTower | StructureLab;
  resource: ResourceConstant;
  amount: number;
  priority: 0 | 1 | 2 | 3 | 4 | 5;
}

const TERMINAL_ENERGY = Math.round(TERMINAL_CAPACITY * 0.2);

@profile
export class storageCell extends Cell {

  storage: StructureStorage;
  links: { [id: string]: StructureLink } = {};
  linksState: { [id: string]: "idle" | "busy" } = {};
  terminal: StructureTerminal | undefined;
  master: managerMaster;

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

    this.pos = this.storage.pos;
    this.master = new managerMaster(this);
  }

  requestFromStorage(ref: string, to: StorageRequest["to"], priority: StorageRequest["priority"]
    , res: StorageRequest["resource"] = RESOURCE_ENERGY, amount: number = 0): number {
    if (!amount || amount === Infinity)
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
    , res: StorageRequest["resource"] = RESOURCE_ENERGY, amount: number = 0): number {

    if (from.structureType === STRUCTURE_LAB && from.mineralType)
      res = from.mineralType;
    if (!amount || amount === Infinity)
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
    if (sendIn)
      return links[0];
    else
      return links.reduce((prev, curr) => curr.cooldown < prev.cooldown ? curr : prev);
  }

  update() {
    super.update(["links"]);

    for (let k in this.requests) {
      let from = <StorageRequest["from"] | null>Game.getObjectById(this.requests[k].from.id);
      if (from)
        this.requests[k].from = from;
      let to = <StorageRequest["to"] | null>Game.getObjectById(this.requests[k].to.id);
      if (to)
        this.requests[k].to = to;
    }

    if (!Object.keys(this.requests).length && this.terminal) {
      if (this.terminal.store.getFreeCapacity() > this.terminal.store.getCapacity() * 0.1) {
        let isFull = this.storage.store.getFreeCapacity() < this.storage.store.getCapacity() * 0.1;
        let res: ResourceConstant = RESOURCE_ENERGY;
        let amount = this.terminal.store.getUsedCapacity(RESOURCE_ENERGY) - TERMINAL_ENERGY;
        if (amount >= 0)
          if (!isFull)
            for (let resourceConstant in this.terminal.store) {
              let resource = <ResourceConstant>resourceConstant;
              if (resource === RESOURCE_ENERGY)
                continue;
              let newAmount = this.terminal.store.getUsedCapacity(resource);
              if (newAmount > amount || res === RESOURCE_ENERGY) {
                res = resource;
                amount = newAmount;
              }
            }
          else
            for (let resourceConstant in this.storage.store) {
              let resource = <ResourceConstant>resourceConstant;
              let newAmount = -this.storage.store.getUsedCapacity(resource);
              if (resource === RESOURCE_ENERGY)
                newAmount += 200000; // save 200K energy everytime
              if (Math.abs(newAmount) > Math.abs(amount)) {
                res = resource;
                amount = newAmount;
              }
            }

        if (amount > 0 && !isFull)
          this.requestToStorage("terminal_" + this.terminal.id, this.terminal, 5, res, Math.min(amount, 5500));
        else if (amount < 0)
          this.requestFromStorage("terminal_" + this.terminal.id, this.terminal, 5, res, Math.min(-amount, 5500));
      }
    }

    for (let id in this.links) {
      let link = this.links[id];
      this.linksState[id] = "idle";
      if (!this.requests["link_" + link.id] && link.store.getUsedCapacity(RESOURCE_ENERGY) > LINK_CAPACITY * 0.5)
        this.requestToStorage("link_" + link.id, link, 4);
    }
    if (this.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 4000 && Object.keys(Apiary.hives).length > 1)
      this.storage.pos.createFlag("boost_" + this.hive.roomName, COLOR_PURPLE, COLOR_WHITE);
  }

  run() {
    for (let k in this.requests) {
      let request = this.requests[k];
      if (request.amount > 0 && !request.from.store[request.resource]
        && !(this.master.manager && this.master.manager.store[request.resource]))
        delete this.requests[k];
      if (!(<Store<ResourceConstant, false>>request.to.store).getFreeCapacity(request.resource))
        delete this.requests[k];
      if (request.amount <= 0)
        delete this.requests[k];
    }

    if (this.terminal && this.terminal.store.getFreeCapacity() < this.terminal.store.getCapacity() * 0.3
      && Apiary.useBucket && !this.terminal.cooldown) {
      let res: ResourceConstant | undefined;
      let amount: number = 0;
      for (let resourceConstant in this.terminal.store) {
        let resource = <ResourceConstant>resourceConstant;
        let newAmount = this.terminal.store.getUsedCapacity(resource);
        if (resource === RESOURCE_ENERGY)
          newAmount -= TERMINAL_ENERGY;
        if (Math.abs(newAmount) > Math.abs(amount)) {
          res = resource;
          amount = newAmount;
        }
      }

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
        if (ans === OK && Apiary.logger)
          Apiary.logger.newMarketOperation(order, amount, this.hive.roomName);
      }
    }
  }
}
