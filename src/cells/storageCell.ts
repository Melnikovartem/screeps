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
      this.inLink = LINK_CAPACITY * 0.5;
    }
  }

  update() {
    super.update();
    // check if manager is needed
    if (!this.beeMaster && this.link && this.hive.stage > 0)
      this.beeMaster = new managerMaster(this);
  }

  run() {
    if (this.link) {
      if (Object.keys(this.linkRequests).length) {
        let key = Object.keys(this.linkRequests)[0];
        let order = this.linkRequests[key];
        let tooBigOrder = order.amount && this.link.store.getUsedCapacity(RESOURCE_ENERGY) < order.amount
          && order.amount <= this.link.store.getCapacity(RESOURCE_ENERGY);
        if (!this.link.cooldown && !tooBigOrder) {
          this.link.transferEnergy(order.link, order.amount);
          delete this.linkRequests[key];

          // back to normal lvl of inLink
          this.inLink = this.link.store.getCapacity(RESOURCE_ENERGY) * 0.5;
        } else if (tooBigOrder) {
          // order.amount literally in tooBigOrder
          this.inLink = order.amount!;
        }
      } else {
        this.inLink = this.link.store.getCapacity(RESOURCE_ENERGY) * 0.5;
      }
    }
  }
}
