import { Cell } from "../_Cell";
import { MinerMaster } from "../../beeMasters/economy/miner";

import { prefix, roomStates } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { ExcavationCell } from "./excavationCell";
import type { Hive } from "../../Hive";

// cell that will extract energy or minerals? from ground <- i am proud with this smart comment i made at 1am
@profile
export class ResourceCell extends Cell {
  resource: Source | Mineral;
  resourceType: ResourceConstant = RESOURCE_ENERGY;
  link: StructureLink | undefined;
  container: StructureContainer | undefined;
  extractor: StructureExtractor | undefined;
  parentCell: ExcavationCell;
  master: MinerMaster;
  roadTime: number = Infinity;
  lair?: StructureKeeperLair;

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
    if (!(this.pos.roomName in Game.rooms))
      return;

    this.container = <StructureContainer>_.filter(this.resource.pos.findInRange(FIND_STRUCTURES, 1),
      s => s.structureType === STRUCTURE_CONTAINER)[0];
    if (this.resource instanceof Source) {
      this.link = <StructureLink>_.filter(this.resource.pos.findInRange(FIND_MY_STRUCTURES, 2),
        s => s.structureType === STRUCTURE_LINK && s.isActive())[0];
      this.operational = this.container || this.link ? true : false;
    } else if (this.resource instanceof Mineral) {
      this.extractor = <StructureExtractor>_.filter(this.resource.pos.lookFor(LOOK_STRUCTURES),
        s => s.structureType === STRUCTURE_EXTRACTOR && s.isActive())[0];
      this.operational = !!(this.extractor && this.container && !this.resource.ticksToRegeneration);
      this.resourceType = this.resource.mineralType;
    }

    let roomInfo = Apiary.intel.getInfo(this.resource.pos.roomName, 10);
    if (roomInfo.currentOwner && roomInfo.currentOwner !== Apiary.username)
      this.operational = false;

    if (roomInfo.roomState === roomStates.SKfrontier) {
      let lair = <StructureKeeperLair>this.pos.findInRange(FIND_STRUCTURES, 5, { filter: { structureType: STRUCTURE_KEEPER_LAIR } })[0];
      if (lair)
        this.lair = lair;
    }

    if (this.operational) {
      if (this.container)
        this.pos = this.container.pos;
      else if (this.link) {
        let poss = this.resource.pos.getOpenPositions(true);
        let pos = this.link.pos.getOpenPositions(true).filter(p => poss.filter(pp => pp.x === p.x && pp.y === p.y).length)[0];
        if (pos)
          this.pos = pos;
        else
          this.pos = this.resource.pos;
      } else
        this.pos = this.resource.pos;
      let storagePos = this.parentCell.master ? this.parentCell.master.dropOff.pos : this.hive.getPos("center");
      this.roadTime = this.pos.getTimeForPath(storagePos);
    }

    if (this.hive.cells.dev)
      this.hive.cells.dev.shouldRecalc = true;
    this.parentCell.shouldRecalc = true;
  }

  update() {
    super.update(undefined, false);

    if (!this.operational && Game.time % 30 === 0)
      this.updateStructure();

    if (this.resourceType !== RESOURCE_ENERGY && this.operational && this.resource.ticksToRegeneration) {
      this.parentCell.shouldRecalc = true;
      this.operational = false;
    }
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
