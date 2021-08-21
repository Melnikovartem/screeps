import { Cell } from "../_Cell";
import { Hive } from "../../Hive";

import { managerMaster } from "../../beeMasters/economy/manager";
import { profile } from "../../profiler/decorator";

export interface StorageRequest {
  ref: string;
  from: (StructureLink | StructureTerminal | StructureStorage | StructureLab)[];
  to: StructureLink | StructureTerminal | StructureStorage | StructureTower | StructureLab;
  resource: ResourceConstant[];
  amount: number[];
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

  requestFromStorageMultiple() {

  }

  requestFromStorage(ref: string, to: StorageRequest["to"], priority: StorageRequest["priority"]
    , minAmount: number = 0, res: ResourceConstant = RESOURCE_ENERGY): number {

    let amount = Math.max(minAmount, this.storage.store.getUsedCapacity(res));
    if (!amount)
      return ERR_NOT_ENOUGH_RESOURCES;

    this.requests[ref] = {
      ref: ref,
      from: [this.storage],
      to: to,
      resource: [res],
      priority: priority,
      amount: [amount],
    };
    return amount ? amount : OK;
  }

  requestToStorage(ref: string, from: StorageRequest["from"], priority: StorageRequest["priority"]): number {
    if (from.length == 0)
      return ERR_NOT_FOUND;
    this.requests[ref] = {
      ref: ref,
      from: [],
      to: this.storage,
      resource: [],
      priority: priority,
      amount: [],
    };
    _.forEach(from, (f) => {
      let res: ResourceConstant | null = RESOURCE_ENERGY;
      if (f instanceof StructureLab)
        res = f.mineralType;
      if (res) {
        let amount = (<Store<ResourceConstant, false>>f.store).getUsedCapacity(res);
        if (amount > 0) {
          this.requests[ref].from.push(f);
          this.requests[ref].resource.push(res);
          this.requests[ref].amount.push(amount);
        }
      }
    });
    if (this.requests[ref].from.length == 0) {
      delete this.requests[ref];
      return 0;
    }
    return _.sum(this.requests[ref].amount);
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

      let to = this.requests[key].to;
      to = <typeof to>Game.getObjectById(to.id);
      if (to)
        this.requests[key].to = to;
    }

    if (this.link && this.link.store[RESOURCE_ENERGY] > LINK_CAPACITY * 0.5 && !this.requests[this.link.id])
      this.requestToStorage(this.link.id, [this.link], 4);

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
        if (req.from[0].id == this.link.id && req.to instanceof StructureLink) {
          let amount = req.amount != undefined ? req.amount : req.to.store.getFreeCapacity(RESOURCE_ENERGY);
          if (amount >= LINK_CAPACITY / 4) {
            request = this.requests[key];
            break;
          }
        }
      }

      if (request && request.from[0].id == this.link.id && request.to instanceof StructureLink) {

        if (this.link.store[RESOURCE_ENERGY] + 25 >= request.amount[0]) {
          if (this.requests[this.link.id])
            this.requests[this.link.id].amount[0] = Math.max(0, this.link.store[RESOURCE_ENERGY] - request.amount[0] * 1.4);
          if (!this.link.cooldown) {
            this.link.transferEnergy(request.to, Math.min(request.amount[0], this.link.store[RESOURCE_ENERGY]));
            delete this.requests[key];
          }
        } else
          this.requestFromStorage(this.link.id, this.link, 4,
            Math.min(Math.ceil(request.amount[0] * 1.2), LINK_CAPACITY) - this.link.store[RESOURCE_ENERGY]);
      }
    }
  }
}
