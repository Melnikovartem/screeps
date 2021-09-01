import { Cell } from "../_Cell";
import { Hive } from "../../Hive";

import { managerMaster } from "../../beeMasters/economy/manager";
import { profile } from "../../profiler/decorator";

export interface StorageRequest {
  ref: string;
  from: (StructureLink | StructureTerminal | StructureStorage | StructureLab)[];
  to: (StructureLink | StructureTerminal | StructureStorage | StructureTower | StructureLab)[];
  resource: ResourceConstant[];
  amount: number[];
  priority: 0 | 1 | 2 | 3 | 4 | 5;
}

@profile
export class storageCell extends Cell {

  storage: StructureStorage;
  link: StructureLink | undefined;
  terminal: StructureTerminal | undefined;
  master: managerMaster;

  requests: { [id: string]: StorageRequest } = {};


  constructor(hive: Hive, storage: StructureStorage) {
    super(hive, "StorageCell_" + hive.room.name);

    this.storage = storage;

    this.link = <StructureLink>_.filter(this.storage.pos.findInRange(FIND_MY_STRUCTURES, 2),
      (structure) => structure.structureType === STRUCTURE_LINK)[0];

    this.terminal = <StructureTerminal>_.filter(this.storage.pos.findInRange(FIND_MY_STRUCTURES, 2),
      (structure) => structure.structureType === STRUCTURE_TERMINAL)[0];

    this.pos = this.storage.pos;
    this.master = new managerMaster(this);
  }

  requestFromStorage(ref: string, to: StorageRequest["to"], priority: StorageRequest["priority"]
    , res: StorageRequest["resource"] = [], amount: number[] = []): number {
    if (to.length === 0)
      return ERR_NOT_FOUND;
    this.requests[ref] = {
      ref: ref,
      from: [this.storage],
      to: [],
      resource: [],
      priority: priority,
      amount: [],
    };
    _.forEach(to, (t, k) => {
      if (!res[k])
        res[k] = RESOURCE_ENERGY;
      if (!amount[k] || amount[k] === Infinity)
        amount[k] = (<Store<ResourceConstant, false>>t.store).getFreeCapacity(res[k]);
      amount[k] = Math.min(amount[k], this.storage.store.getUsedCapacity(res[k]));

      if (amount[k] > 0) {
        this.requests[ref].to.push(t);
        this.requests[ref].resource.push(res[k]);
        this.requests[ref].amount.push(amount[k]);
      }
    });
    if (this.requests[ref].to.length === 0) {
      delete this.requests[ref];
      return 0;
    }
    return _.sum(this.requests[ref].amount);
  }

  requestToStorage(ref: string, from: StorageRequest["from"], priority: StorageRequest["priority"]
    , res: StorageRequest["resource"] = [], amount: number[] = []): number {
    if (from.length === 0)
      return ERR_NOT_FOUND;
    this.requests[ref] = {
      ref: ref,
      from: [],
      to: [this.storage],
      resource: [],
      priority: priority,
      amount: [],
    };
    _.forEach(from, (f, k) => {
      if (!res[k])
        res[k] = RESOURCE_ENERGY;
      if (f instanceof StructureLab && f.mineralType)
        res[k] = f.mineralType;
      if (!amount[k] || amount[k] === Infinity)
        amount[k] = (<Store<ResourceConstant, false>>f.store).getUsedCapacity(res[k]);
      amount[k] = Math.min(amount[k], this.storage.store.getFreeCapacity(res[k]));

      if (amount[k] > 0) {
        this.requests[ref].from.push(f);
        this.requests[ref].resource.push(res[k]);
        this.requests[ref].amount.push(amount[k]);
      }
    });
    if (this.requests[ref].from.length === 0) {
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

      for (const toKey in this.requests[key].to) {
        let to = this.requests[key].to[toKey];
        to = <typeof to>Game.getObjectById(to.id);
        if (to)
          this.requests[key].to[toKey] = to;
      }
    }

    if (this.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 1000)
      this.storage.pos.createFlag("boost_" + this.hive.roomName, COLOR_PURPLE, COLOR_WHITE);

    if (this.link && this.link.store.getUsedCapacity(RESOURCE_ENERGY) > LINK_CAPACITY * 0.5 && !this.requests[this.link.id])
      this.requestToStorage(this.link.id, [this.link], 4);
  }

  run() {
    // operate link if any request to send
    if (this.link) {
      let key: string = "";
      let request;
      for (key in this.requests) {
        let req = this.requests[key];
        if (req.from[0].id === this.link.id && req.to[0] instanceof StructureLink) {
          if (req.amount[0] >= LINK_CAPACITY / 4) {
            request = this.requests[key];
            break;
          }
        }
      }

      if (request && request.from[0].id === this.link.id && request.to[0] instanceof StructureLink) {
        if (this.link.store.getUsedCapacity(RESOURCE_ENERGY) + 25 >= request.amount[0]) {
          if (this.requests[this.link.id])
            this.requests[this.link.id].amount[0] = Math.max(0, this.link.store.getUsedCapacity(RESOURCE_ENERGY) - request.amount[0] * 1.4);
          if (!this.link.cooldown)
            if (this.link.transferEnergy(request.to[0], Math.min(request.amount[0], this.link.store.getUsedCapacity(RESOURCE_ENERGY))) === OK)
              delete this.requests[key];
        } else
          this.requestFromStorage(this.link.id, [this.link], 4, undefined,
            [Math.min(Math.ceil(request.amount[0] * 1.2), LINK_CAPACITY) - this.link.store.getUsedCapacity(RESOURCE_ENERGY)]);
      }
    }
  }
}
