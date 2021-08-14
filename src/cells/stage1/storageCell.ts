import { Cell } from "../_Cell";
import { Hive } from "../../Hive";

import { managerMaster } from "../../beeMaster/civil/manager";
import { UPDATE_EACH_TICK } from "../../settings";
import { profile } from "../../profiler/decorator";

export interface StorageRequest {
  from: StructureLink | StructureTerminal | StructureStorage;
  to: StructureLink | StructureTerminal | StructureStorage | StructureTower;
  resource: ResourceConstant;
  amount?: number;
  priority: 0 | 1 | 2 | 3 | 4 | 5,
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

  update() {
    super.update();

    if (UPDATE_EACH_TICK)
      for (let key in this.requests) {
        let from = this.requests[key].from;
        from = <typeof from>Game.getObjectById(this.requests[key].from.id);
        if (from)
          this.requests[key].from = from;

        let to = this.requests[key].from;
        to = <typeof to>Game.getObjectById(this.requests[key].to.id);
        if (to)
          this.requests[key].to = to;
      }

    if (this.link && this.link.store[RESOURCE_ENERGY] > LINK_CAPACITY * 0.5 && !this.requests[this.link.id])
      this.requests[this.link.id] = {
        from: this.link,
        to: this.storage,
        resource: RESOURCE_ENERGY,
        amount: this.link.store[RESOURCE_ENERGY] - LINK_CAPACITY * 0.5,
        priority: 3,
      };

    if (!this.beeMaster)
      this.beeMaster = new managerMaster(this);
  }

  run() {
    // operate link if any request to send
    if (this.link) {
      let key: string = "";
      let request;
      for (key in this.requests) {
        if (this.requests[key].from.id == this.link.id
          && (this.requests[key].amount == undefined || this.requests[key].amount! >= LINK_CAPACITY / 4)) {
          request = this.requests[key];
          break;
        }
      }

      if (request && request.from.id == this.link.id && request.to instanceof StructureLink) {
        if (request.amount == 0) {
          delete this.requests[key];
        } else {

          let amount = request.amount != undefined ? request.amount : request.to.store.getFreeCapacity(RESOURCE_ENERGY);
          if (amount > LINK_CAPACITY)
            amount = LINK_CAPACITY;

          if (this.link.store[RESOURCE_ENERGY] >= amount || amount - this.link.store[RESOURCE_ENERGY] < 25) {
            if (this.requests[this.link.id])
              this.requests[this.link.id].amount = Math.max(0, this.link.store[RESOURCE_ENERGY] - amount * 1.2);
            if (!this.link.cooldown) {
              this.link.transferEnergy(request.to, Math.min(amount, this.link.store[RESOURCE_ENERGY]));
              delete this.requests[key];
            }
          } else
            this.requests[this.link.id] = {
              from: this.storage,
              to: this.link,
              resource: RESOURCE_ENERGY,
              amount: amount - this.link.store[RESOURCE_ENERGY],
              priority: 3,
            };
        }
      }
    }
  }
}
