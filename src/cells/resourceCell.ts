import { Cell } from "./_Cell";
import { Hive } from "../Hive";

import { minerMaster } from "../beeMaster/civil/miner";
import { UPDATE_EACH_TICK } from "../settings";

// cell that will extract energy or minerals? from ground
export class resourceCell extends Cell {

  perSecond: number = Infinity;
  resource: Source | Mineral;
  link: StructureLink | undefined;
  container: StructureContainer | undefined;
  extractor: StructureExtractor | undefined;


  constructor(hive: Hive, resource: Source | Mineral) {
    super(hive, "resourceCell_" + resource.id);

    this.resource = resource;

    this.container = <StructureContainer>_.filter(this.resource.pos.findInRange(FIND_STRUCTURES, 2),
      (structure) => structure.structureType == STRUCTURE_CONTAINER)[0];

    if (resource instanceof Source) {
      this.perSecond = 10 //for energy aka 3000/300
      this.link = <StructureLink>_.filter(this.resource.pos.findInRange(FIND_MY_STRUCTURES, 2),
        (structure) => structure.structureType == STRUCTURE_LINK)[0];
    } else if (resource instanceof Mineral) {
      this.extractor = <StructureExtractor>_.filter(resource.pos.lookFor(LOOK_STRUCTURES),
        (structure) => structure.structureType == STRUCTURE_EXTRACTOR)[0];
    }
  }

  update() {
    super.update();

    if (UPDATE_EACH_TICK) {
      let sourceNew = Game.getObjectById(this.resource.id);
      if (sourceNew instanceof Source || sourceNew instanceof Mineral)
        this.resource = sourceNew;
    }

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
