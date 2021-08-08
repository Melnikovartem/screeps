import { Cell } from "./_Cell";
import { Hive } from "../Hive";

import { managerMaster } from "../beeMaster/manager"

export interface linkRequest {
  target: StructureLink;
  resourceType: ResourceConstant;
  amount?: number;
}

export class storageCell extends Cell {

  storage: StructureStorage;
  link: StructureLink | undefined;

  percentInLink: number = 0.5;
  linkRequests: linkRequest[] = [];


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
    if (!this.beeMaster)
      this.beeMaster = new managerMaster(this);
  }

  run() {
    if (this.link) {

    }
  }
}
