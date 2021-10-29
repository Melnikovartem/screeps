import { Cell } from "../_Cell";
import { MinerMaster } from "../../beeMasters/economy/miner";

import { prefix, roomStates, hiveStates } from "../../enums";

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

  lair?: StructureKeeperLair;

  ratePT: number = SOURCE_ENERGY_CAPACITY / ENERGY_REGEN_TIME;

  operational: boolean = false;

  constructor(hive: Hive, resource: Source | Mineral, excavationCell: ExcavationCell) {
    super(hive, prefix.resourceCells + resource.id);
    this.resource = resource;

    this.setCahe("roadTime", Infinity);
    this.setCahe("restTime", Infinity);
    this.setCahe("pos", this.resource.pos);

    if (resource instanceof Mineral)
      this.resourceType = resource.mineralType;
    this.parentCell = excavationCell;
    this.master = new MinerMaster(this);
    this.updateStructure();
  }

  get roadTime(): number {
    return this.fromCache("roadTime");
  }

  set roadTime(value) {
    this.toCache("roadTime", value);
  }

  get restTime(): number {
    return this.fromCache("restTime");
  }

  set restTime(value) {
    this.toCache("restTime", value);
  }

  set pos(value) {
    this.toCache("pos", value);
  }

  get pos(): RoomPosition {
    let p = this.fromCache("pos");
    return new RoomPosition(p.x, p.y, p.roomName);
  }


  updateStructure() {
    if (!(this.pos.roomName in Game.rooms))
      return;


    this.roadTime = Infinity;
    this.restTime = Infinity;

    this.container = <StructureContainer>_.filter(this.resource.pos.findInRange(FIND_STRUCTURES, 1),
      s => s.structureType === STRUCTURE_CONTAINER)[0];
    if (this.resource instanceof Source) {
      this.link = <StructureLink>_.filter(this.resource.pos.findInRange(FIND_MY_STRUCTURES, 2),
        s => s.structureType === STRUCTURE_LINK && s.isActive())[0];
      this.operational = this.container || (this.link && this.hive.cells.storage && Object.keys(this.hive.cells.storage.links).length) ? true : false;
    } else if (this.resource instanceof Mineral) {
      this.extractor = <StructureExtractor>_.filter(this.resource.pos.lookFor(LOOK_STRUCTURES),
        s => s.structureType === STRUCTURE_EXTRACTOR && s.isActive())[0];
      this.operational = !!(this.extractor && this.container && !this.resource.ticksToRegeneration);
      this.ratePT = 0
      if (this.operational) {
        let timeToChop = Math.max(this.master.activeBees.length ? this.master.activeBees[0].ticksToLive : CREEP_LIFE_TIME, 201) - 200;
        this.ratePT = this.resource.mineralAmount / timeToChop;
      }
    }

    let roomInfo = Apiary.intel.getInfo(this.resource.pos.roomName, Infinity);

    if (roomInfo.roomState === roomStates.SKfrontier) {
      let lair = <StructureKeeperLair>this.pos.findInRange(FIND_STRUCTURES, 5, { filter: { structureType: STRUCTURE_KEEPER_LAIR } })[0];
      if (lair)
        this.lair = lair;
    }

    if (this.container)
      this.pos = this.container.pos;
    else if (this.link) {
      let poss = this.resource.pos.getOpenPositions(true);
      let pos = this.link.pos.getOpenPositions(true).filter(p => poss.filter(pp => p.equal(pp)).length)[0];
      if (pos)
        this.pos = pos;
    }

    let storagePos = this.parentCell.master ? this.parentCell.master.dropOff.pos : this.hive.pos;
    if (this.roadTime === Infinity)
      this.roadTime = this.pos.getTimeForPath(storagePos);
    if (this.restTime === Infinity)
      this.restTime = this.pos.getTimeForPath(this.hive.rest);

    if (this.hive.cells.dev)
      this.hive.cells.dev.shouldRecalc = true;
    this.parentCell.shouldRecalc = true;
  }

  update() {
    super.update(undefined, false);

    if (!this.resource && this.resourceType === RESOURCE_ENERGY)
      this.resource = this.pos.findInRange(FIND_SOURCES, 1)[0];

    if (!this.operational && Game.time % 30 === 0)
      this.updateStructure();

    if (this.resourceType !== RESOURCE_ENERGY && this.operational && this.resource.ticksToRegeneration) {
      this.parentCell.shouldRecalc = true;
      this.operational = false;
      this.ratePT = 0;
    }
  }

  run() {
    if (this.link && !this.link.cooldown) {
      let usedCap = this.link.store.getUsedCapacity(RESOURCE_ENERGY)
      if (usedCap >= LINK_CAPACITY / 4 && this.link.cooldown === 0) {
        let closeToFull = usedCap >= LINK_CAPACITY / 1.1428;

        let upgradeLink = this.hive.state === hiveStates.economy && this.hive.cells.upgrade && this.hive.cells.upgrade.link;
        if (upgradeLink && (upgradeLink.store.getFreeCapacity(RESOURCE_ENERGY) >= usedCap
          || upgradeLink.store.getFreeCapacity(RESOURCE_ENERGY) >= LINK_CAPACITY / 8 && !closeToFull)) {
          let ans = this.link.transferEnergy(upgradeLink);
          if (ans === OK) {
            if (Apiary.logger)
              Apiary.logger.resourceTransfer(this.hive.roomName, "mining_" + this.resource.id.slice(this.resource.id.length - 4),
                this.link.store, upgradeLink.store, RESOURCE_ENERGY, 1, 0.03);
            return;
          }
        }

        let storageLink = this.hive.cells.storage && this.hive.cells.storage.getFreeLink(true);
        if (storageLink && (usedCap <= storageLink.store.getFreeCapacity(RESOURCE_ENERGY) || closeToFull)) {
          let ans = this.link.transferEnergy(storageLink);
          this.hive.cells.storage!.linksState[storageLink.id] = "busy";
          if (Apiary.logger && ans === OK)
            Apiary.logger.resourceTransfer(this.hive.roomName, "mining_" + this.resource.id.slice(this.resource.id.length - 4),
              this.link.store, storageLink.store, RESOURCE_ENERGY, 1, 0.03);

        }
      }
    }
  }
}
