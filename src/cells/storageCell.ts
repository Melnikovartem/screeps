import { Cell } from "./_Cell";
import { Hive } from "../Hive";

import { managerMaster } from "../beeMaster/manager"

export interface linkRequest {
  link: StructureLink;
  amount?: number;
}

export class storageCell extends Cell {

  storage: StructureStorage;
  link: StructureLink | undefined;

  inLink: number = 0;
  linkRequests: { [id: string]: linkRequest } = {};


  constructor(hive: Hive, storage: StructureStorage) {
    super(hive, "storageCell_" + hive.room.name);

    this.storage = storage;

    let link = _.filter(this.storage.pos.findInRange(FIND_MY_STRUCTURES, 2), (structure) => structure.structureType == STRUCTURE_LINK)[0];
    if (link instanceof StructureLink) {
      this.link = link;
      this.inLink = link.store.getCapacity(RESOURCE_ENERGY) * 0.5;
    }
  }

  update() {
    super.update();
    if (!this.beeMaster)
      this.beeMaster = new managerMaster(this);
  }

  run() {
    if (this.link && Object.keys(this.linkRequests).length) {
      let key = Object.keys(this.linkRequests)[0];
      let order = this.linkRequests[key];
      if (!this.link.cooldown && (!order.amount || this.link.store.getUsedCapacity(RESOURCE_ENERGY) >= order.amount
        || order.amount >= this.inLink)) {
        this.link.transferEnergy(order.link, order.amount);
        delete this.linkRequests[key];
      }
    }
  }
}
