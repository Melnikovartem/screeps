import { Cell } from "../_Cell";
import { MinerMaster } from "../../beeMasters/economy/miner";

import { prefix } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { ExcavationCell } from "./excavationCell";
import type { Hive } from "../../Hive";

// cell that will extract energy or minerals? from ground <- i am proud with this smart comment i made at 1am
@profile
export class ResourceCell extends Cell {

  perSecondNeeded: number = 5; // aka 3000/300/2 for energy
  resource: Source | Mineral;
  resourceType: ResourceConstant = RESOURCE_ENERGY;
  link: StructureLink | undefined;
  container: StructureContainer | undefined;
  extractor: StructureExtractor | undefined;
  parentCell: ExcavationCell;
  master: MinerMaster;

  operational: boolean = false;

  constructor(hive: Hive, resource: Source | Mineral, excavationCell: ExcavationCell) {
    super(hive, prefix.resourceCells + resource.id);

    this.resource = resource;
    this.pos = this.resource.pos;
    this.parentCell = excavationCell;
    this.master = new MinerMaster(this);
    this.updateStructure();
  }

  updateStructure() {
    this.container = <StructureContainer>_.filter(this.resource.pos.findInRange(FIND_STRUCTURES, 1),
      structure => structure.structureType === STRUCTURE_CONTAINER)[0];
    if (this.resource instanceof Source) {
      this.link = <StructureLink>_.filter(this.resource.pos.findInRange(FIND_MY_STRUCTURES, 2),
        structure => structure.structureType === STRUCTURE_LINK)[0];
      this.operational = this.container || this.link ? true : false;
    } else if (this.resource instanceof Mineral) {
      this.extractor = <StructureExtractor>_.filter(this.resource.pos.lookFor(LOOK_STRUCTURES),
        structure => structure.structureType === STRUCTURE_EXTRACTOR)[0];
      this.operational = this.extractor && this.container ? true : false;
      this.perSecondNeeded = this.resource.ticksToRegeneration ? 0 : Infinity;
      this.resourceType = this.resource.mineralType;
    }

    let roomInfo = Apiary.intel.getInfo(this.resource.pos.roomName, 10);
    if (roomInfo.currentOwner !== Apiary.username)
      this.operational = false;

    if (this.operational) {
      this.parentCell.shouldRecalc = true;
      if (this.container)
        this.pos = this.container.pos;
      else
        this.pos = this.resource.pos;
    }
  }

  update() {
    super.update(undefined, false);

    if (!this.operational && Game.time % 30 === 0)
      this.updateStructure();

    if (this.container && !Game.getObjectById(this.container.id)) {
      this.container = undefined;
      this.operational = false;
    }

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
