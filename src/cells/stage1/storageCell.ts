import { Cell } from "../_Cell";
import { Hive } from "../../Hive";

import { managerMaster } from "../../beeMasters/economy/manager";
import { profile } from "../../profiler/decorator";

export interface StorageRequest {
  ref: string;
  from: (StructureLink | StructureTerminal | StructureStorage | StructureLab)[];
  to: (StructureLink | StructureTerminal | StructureStorage | StructureTower | StructureLab)[];
  resource: ResourceConstant;
  amount?: number;
  priority: 0 | 1 | 2 | 3 | 4 | 5;
  multipleFrom?: boolean;
}

@profile
export class storageCell extends Cell {

  storage: StructureStorage;
  link: StructureLink | undefined;
  terminal: StructureTerminal | undefined;

  requests: { [id: string]: StorageRequest } = {};


  constructor(hive: Hive, storage: StructureStorage) {
    super(hive, "StorageCell_" + hive.room.name);

    this.storage = storage;

    this.link = <StructureLink>_.filter(this.storage.pos.findInRange(FIND_MY_STRUCTURES, 2),
      (structure) => structure.structureType == STRUCTURE_LINK)[0];

    this.terminal = <StructureTerminal>_.filter(this.storage.pos.findInRange(FIND_MY_STRUCTURES, 2),
      (structure) => structure.structureType == STRUCTURE_TERMINAL)[0];

    this.pos = this.storage.pos;
  }

  requestFromStorage(ref: string, to: StorageRequest["to"], priority: StorageRequest["priority"],
    amount?: number, resource?: ResourceConstant): number {
    if (to.length == 0)
      return ERR_INVALID_ARGS;
    resource = resource ? resource : RESOURCE_ENERGY;
    if (this.storage.store.getUsedCapacity(resource) == 0)
      return ERR_NOT_ENOUGH_RESOURCES;
    if (amount != undefined && amount == 0)
      return ERR_INVALID_ARGS;
    if (amount)
      amount = Math.min(this.storage.store.getUsedCapacity(resource), amount);

    this.requests[ref] = {
      ref: ref,
      from: [this.storage],
      to: to.sort((a, b) => a.pos.getRangeTo(this.storage) - b.pos.getRangeTo(this.storage)),
      resource: resource,
      priority: priority,
      amount: amount,
    };
    return amount ? amount : OK;
  }

  update() {
    super.update();

    for (const key in this.requests) {
      for (const fromKey in this.requests[key].from) {
        let from = this.requests[key].from[fromKey];
        from = <typeof from>Game.getObjectById(from.id);
        if (from)
          this.requests[key].from[fromKey] = from;
      }

      for (const toKey in this.requests[key].to) {
        let to = this.requests[key].to[toKey];
        to = <typeof to>Game.getObjectById(to.id);
        if (to)
          this.requests[key].to[toKey] = to;
      }
    }

    if (this.link && this.link.store[RESOURCE_ENERGY] > LINK_CAPACITY * 0.5 && !this.requests[this.link.id])
      this.requests[this.link.id] = {
        ref: this.link.id,
        from: [this.link],
        to: [this.storage],
        resource: RESOURCE_ENERGY,
        amount: this.link.store[RESOURCE_ENERGY] - LINK_CAPACITY * 0.5,
        priority: 4,
      };

    if (!this.master)
      this.master = new managerMaster(this);
  }

  run() {
    // operate link if any request to send
    if (this.link) {
      let key: string = "";
      let request;
      for (key in this.requests) {
        let req = this.requests[key];
        if (req.from[0].id == this.link.id && req.to[0] instanceof StructureLink) {
          let amount = req.amount != undefined ? req.amount : req.to[0].store.getFreeCapacity(RESOURCE_ENERGY);
          if (amount >= LINK_CAPACITY / 4) {
            request = this.requests[key];
            break;
          }
        }
      }

      if (request && request.from[0].id == this.link.id && request.to[0] instanceof StructureLink) {
        if (request.amount == 0) {
          delete this.requests[key];
        } else {
          let amount = request.amount != undefined ? request.amount : request.to[0].store.getFreeCapacity(RESOURCE_ENERGY);
          if (amount > LINK_CAPACITY)
            amount = LINK_CAPACITY;

          if (this.link.store[RESOURCE_ENERGY] + 25 >= amount) {
            if (this.requests[this.link.id])
              this.requests[this.link.id].amount = Math.max(0, this.link.store[RESOURCE_ENERGY] - amount * 1.4);
            if (!this.link.cooldown) {
              this.link.transferEnergy(request.to[0], Math.min(amount, this.link.store[RESOURCE_ENERGY]));
              delete this.requests[key];
            }
          } else
            this.requestFromStorage(this.link.id, [this.link], 4, Math.min(Math.ceil(amount * 1.2), LINK_CAPACITY) - this.link.store[RESOURCE_ENERGY]);
        }
      }
    }
  }
}
