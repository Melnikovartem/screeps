import { Cell } from "./_Cell";
import { Hive } from "../Hive";

import { minerMaster } from "../beeMaster/civil/miner";
import { UPDATE_EACH_TICK } from "../settings";

// cell that will extract energy or minerals? from ground
export class resourceCell extends Cell {

  perSecond: number = 0;
  resource: Source | Mineral;
  link: StructureLink | undefined;
  container: StructureContainer | undefined;
  extractor: StructureExtractor | undefined;


  constructor(hive: Hive, resource: Source | Mineral) {
    super(hive, "resourceCell_" + resource.id);

    this.resource = resource;

    this.container = <StructureContainer>_.filter(this.resource.pos.findInRange(FIND_STRUCTURES, 2),
      (structure) => structure.structureType == STRUCTURE_CONTAINER)[0];

    if (this.resource instanceof Source)
      this.link = <StructureLink>_.filter(this.resource.pos.findInRange(FIND_MY_STRUCTURES, 2),
        (structure) => structure.structureType == STRUCTURE_LINK)[0];
    else if (this.resource instanceof Mineral)
      this.extractor = <StructureExtractor>_.filter(resource.pos.lookFor(LOOK_STRUCTURES),
        (structure) => structure.structureType == STRUCTURE_EXTRACTOR)[0];

    this.updateResourceInfo();
  }

  updateResourceInfo() {
    if (this.resource.ticksToRegeneration != 0) {
      if (this.resource instanceof Mineral) {
        let ticksToRegeneration = this.resource.ticksToRegeneration ? this.resource.ticksToRegeneration : MINERAL_REGEN_TIME;
        this.perSecond = this.resource.mineralAmount / ticksToRegeneration;
      } else if (this.resource instanceof Source) {
        let ticksToRegeneration = this.resource.ticksToRegeneration ? this.resource.ticksToRegeneration : ENERGY_REGEN_TIME;
        this.perSecond = this.resource.energy / ticksToRegeneration;
      }
    }
  }

  update() {
    super.update();

    if (UPDATE_EACH_TICK || Game.time % 50 == 27) {
      let resourceNew = Game.getObjectById(this.resource.id);
      if (resourceNew instanceof Source || resourceNew instanceof Mineral)
        this.resource = resourceNew;
      this.updateResourceInfo();
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
