import { Cell } from "./_Cell";
import { Hive } from "../Hive";

import { minerMaster } from "../beeMaster/miner";

// cell that will extract energy or minerals? from ground
export class resourceCell extends Cell {

  source: Source;
  link: StructureLink | undefined;
  container: StructureContainer | undefined;


  constructor(hive: Hive, source: Source) {
    super(hive, "resourceCell_" + source.id);

    this.source = source;

    let container = _.filter(this.source.pos.findInRange(FIND_STRUCTURES, 2), (structure) => structure.structureType == STRUCTURE_CONTAINER)[0];
    if (container instanceof StructureContainer) {
      this.container = container;
    }

    let link = _.filter(this.source.pos.findInRange(FIND_MY_STRUCTURES, 2), (structure) => structure.structureType == STRUCTURE_LINK)[0];
    if (link instanceof StructureLink) {
      this.link = link;
    }
  }

  update() {
    super.update();
    if (!this.beeMaster)
      this.beeMaster = new minerMaster(this);
  }

  run() {
    if (this.link && this.hive.cells.storageCell && this.hive.cells.storageCell.link &&
      (this.link.store.getUsedCapacity(RESOURCE_ENERGY) >= this.hive.cells.storageCell.link.store.getCapacity(RESOURCE_ENERGY)
        - this.hive.cells.storageCell.inLink || this.link.store.getFreeCapacity(RESOURCE_ENERGY) <
        this.link.store.getCapacity(RESOURCE_ENERGY) * 0.15) && this.link.cooldown == 0) {
      this.link.transferEnergy(this.hive.cells.storageCell.link);
    }
  }
}
