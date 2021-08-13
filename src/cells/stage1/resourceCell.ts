import { Cell } from "../_Cell";
import { Hive } from "../../Hive";

import { minerMaster } from "../../beeMaster/civil/miner";
import { profile } from "../../profiler/decorator";

// cell that will extract energy or minerals? from ground <- i am proud with this smart comment i made at 1am
@profile
export class resourceCell extends Cell {

  perSecondNeeded: number = 5; // aka 3000/300/2 for energy
  resource: Source | Mineral;
  resourceType: ResourceConstant = RESOURCE_ENERGY;
  link: StructureLink | undefined;
  container: StructureContainer | undefined;
  extractor: StructureExtractor | undefined;

  operational: boolean = false;


  constructor(hive: Hive, resource: Source | Mineral) {
    super(hive, "ResourceCell_" + resource.id);

    this.resource = resource;

    this.container = <StructureContainer>_.filter(this.resource.pos.findInRange(FIND_STRUCTURES, 2),
      (structure) => structure.structureType == STRUCTURE_CONTAINER)[0];


    this.pos = this.resource.pos;
    this.updateStructure();
  }

  updateStructure() {
    if (this.resource instanceof Source) {
      this.link = <StructureLink>_.filter(this.resource.pos.findInRange(FIND_MY_STRUCTURES, 2),
        (structure) => structure.structureType == STRUCTURE_LINK)[0];
      this.operational = this.container || this.link ? true : false;
    } else if (this.resource instanceof Mineral) {
      this.extractor = <StructureExtractor>_.filter(this.resource.pos.lookFor(LOOK_STRUCTURES),
        (structure) => structure.structureType == STRUCTURE_EXTRACTOR)[0];
      this.operational = this.extractor && this.container ? true : false;
      this.perSecondNeeded = this.resource.ticksToRegeneration ? 0 : Infinity;
      this.resourceType = this.resource.mineralType;
    }

    let roomInfo = Apiary.intel.getInfo(this.pos.roomName, 10);
    if (roomInfo.ownedByEnemy)
      this.operational = false;
  }

  update() {
    super.update();

    if (Game.time % 20 == 7 && !this.operational)
      this.updateStructure();

    if (this.resource instanceof Mineral && Game.time % 10 == 0)
      this.perSecondNeeded = this.resource.ticksToRegeneration ? 0 : Infinity;

    if (!this.beeMaster && this.operational)
      this.beeMaster = new minerMaster(this);
  }

  run() {
    if (this.link && this.link.store[RESOURCE_ENERGY] >= 100 && this.link.cooldown == 0 &&
      this.hive.cells.storageCell && this.hive.cells.storageCell.link &&
      (this.link.store[RESOURCE_ENERGY] <= this.hive.cells.storageCell.link.store.getFreeCapacity(RESOURCE_ENERGY) ||
        this.link.store.getFreeCapacity(RESOURCE_ENERGY) <= 150)) {
      this.link.transferEnergy(this.hive.cells.storageCell.link);
    }
  }
}
