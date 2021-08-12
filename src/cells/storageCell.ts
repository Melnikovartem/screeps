import { Cell } from "./_Cell";
import { Hive } from "../Hive";

import { managerMaster } from "../beeMaster/civil/manager";

import { UPDATE_EACH_TICK } from "../settings";

export interface StorageRequest {
  from: StructureLink | StructureTerminal | StructureStorage;
  to: StructureLink | StructureTerminal | StructureStorage | StructureTower;
  resource: ResourceConstant;
  amount?: number;
  priority: 0 | 1 | 2 | 3 | 4 | 5,
}

export class storageCell extends Cell {

  storage: StructureStorage;
  link: StructureLink | undefined;
  terminal: StructureTerminal | undefined;

  requests: { [id: string]: StorageRequest } = {};


  constructor(hive: Hive, storage: StructureStorage) {
    super(hive, "storageCell_" + hive.room.name);

    this.storage = storage;

    let link = _.filter(this.storage.pos.findInRange(FIND_MY_STRUCTURES, 2), (structure) => structure.structureType == STRUCTURE_LINK)[0];
    if (link instanceof StructureLink) {
      this.link = link;
    }
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

    if (this.link) {
      // link requests

      if (this.link.store.getUsedCapacity(RESOURCE_ENERGY) > LINK_CAPACITY * 0.5 && !this.requests[this.link.id])
        this.requests[this.link.id] = {
          from: this.link,
          to: this.storage,
          resource: RESOURCE_ENERGY,
          amount: this.link.store.getUsedCapacity(RESOURCE_ENERGY) - LINK_CAPACITY * 0.5,
          priority: 3,
        };


      let key = Object.keys(this.requests)[0];
      let request = this.requests[key];
      for (key in this.requests) {
        request = this.requests[key];
        if (request.from == this.link)
          break;
      }

      if (request && request.from.id == this.link.id && request.to instanceof StructureLink) {
        if (request.amount && request.amount > LINK_CAPACITY)
          request.amount = LINK_CAPACITY;

        let tooBigrequest = request.amount && this.link.store.getUsedCapacity(RESOURCE_ENERGY) < request.amount;
        if (!tooBigrequest) {
          delete this.requests[this.link.id];
          if (!this.link.cooldown)
            this.link.transferEnergy(request.to, request.amount);
          delete this.requests[key];
        } else if (tooBigrequest)
          this.requests[this.link.id] = {
            from: this.storage,
            to: this.link,
            resource: RESOURCE_ENERGY,
            amount: request.amount! - this.link.store.getUsedCapacity(RESOURCE_ENERGY),
            priority: 3,
          };
      }
    }

    // check if manager is needed
    if (!this.beeMaster && this.hive.stage > 0 && (this.link || this.hive.cells.defenseCell))
      this.beeMaster = new managerMaster(this);
  }

  run() { }
}
