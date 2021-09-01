import { Cell } from "../_Cell";
import { Hive } from "../../Hive";

import { excavationCell } from "./excavationCell";
import { minerMaster } from "../../beeMasters/economy/miner";
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
  parentCell: excavationCell;
  master: minerMaster;

  operational: boolean = false;

  constructor(hive: Hive, resource: Source | Mineral, excavationCell: excavationCell) {
    super(hive, "ResourceCell_" + resource.id);

    this.resource = resource;
    this.pos = this.resource.pos;
    this.parentCell = excavationCell;
    this.master = new minerMaster(this);
    this.updateStructure();
  }

  updateStructure() {
    this.container = <StructureContainer>_.filter(this.resource.pos.findInRange(FIND_STRUCTURES, 2),
      (structure) => structure.structureType === STRUCTURE_CONTAINER)[0];
    if (this.resource instanceof Source) {
      this.link = <StructureLink>_.filter(this.resource.pos.findInRange(FIND_MY_STRUCTURES, 2),
        (structure) => structure.structureType === STRUCTURE_LINK)[0];
      this.operational = this.container || this.link ? true : false;
    } else if (this.resource instanceof Mineral) {
      this.extractor = <StructureExtractor>_.filter(this.resource.pos.lookFor(LOOK_STRUCTURES),
        (structure) => structure.structureType === STRUCTURE_EXTRACTOR)[0];
      this.operational = this.extractor && this.container ? true : false;
      this.perSecondNeeded = this.resource.ticksToRegeneration ? 0 : Infinity;
      this.resourceType = this.resource.mineralType;
    }

    let roomInfo = Apiary.intel.getInfo(this.resource.pos.roomName, 10);
    if (roomInfo.ownedByEnemy)
      this.operational = false;

    if (this.operational) {
      this.parentCell.shouldRecalc = true;
      let posNear: RoomPosition[] = [];
      if (this.container)
        posNear = this.container.pos.getOpenPositions(true);
      if (this.link)
        posNear = this.link.pos.getOpenPositions(true);
      this.pos = _.filter(this.resource.pos.getOpenPositions(true),
        (p) => _.filter(posNear, (pp) => pp.x == p.x && pp.y == p.y).length > 0)[0];
      if (!this.pos)
        this.pos = this.resource.pos;
    }
  }

  update() {
    super.update();

    if (!this.operational && Game.time % 30 === 0)
      this.updateStructure();
    if ((!this.container && !this.link) || (this.resource instanceof Mineral && !this.extractor))
      this.operational = false;

    if (this.resource instanceof Mineral && Game.time % 10 === 0)
      this.perSecondNeeded = this.resource.ticksToRegeneration ? 0 : Infinity;
  }

  run() {
    if (this.link) {
      let usedCap = this.link.store.getUsedCapacity(RESOURCE_ENERGY)
      if (usedCap >= LINK_CAPACITY / 8 && this.link.cooldown === 0 && this.hive.cells.storage) {
        let storageLink = this.hive.cells.storage.getFreeLink(true);
        if (storageLink && (usedCap <= storageLink.store.getFreeCapacity(RESOURCE_ENERGY) || usedCap >= LINK_CAPACITY / 1.1428)) {
          let ans = this.link.transferEnergy(storageLink);
          this.hive.cells.storage.linksState[storageLink.id] = "busy";
          if (Apiary.logger && ans === OK)
            Apiary.logger.resourceTransfer(this.hive.roomName, "mining_" + this.resource.id.slice(this.resource.id.length - 4),
              this.link.store, storageLink.store, RESOURCE_ENERGY, 1, 0.03);

        }
      }
    }
  }
}
