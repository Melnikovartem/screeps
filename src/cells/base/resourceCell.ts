import { MinerMaster } from "../../beeMasters/economy/miner";
import type { Hive } from "../../hive/hive";
import { profile } from "../../profiler/decorator";
import { hiveStates, prefix, roomStates } from "../../static/enums";
import { Traveler } from "../../Traveler/TravelerModified";
import { Cell } from "../_Cell";
import type { ExcavationCell } from "./excavationCell";

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

  updateTime: number;
  lair?: StructureKeeperLair;

  operational: boolean = false;

  constructor(
    hive: Hive,
    resource: Source | Mineral,
    excavationCell: ExcavationCell
  ) {
    super(hive, prefix.resourceCells + resource.id);
    this.resource = resource;

    this.initCache("roadTime", Infinity);
    this.initCache("restTime", Infinity);
    this.initCache("pos", this.resource.pos);

    if (resource instanceof Mineral) this.resourceType = resource.mineralType;
    this.parentCell = excavationCell;
    this.master = new MinerMaster(this);
    this.updateTime = this.resourceType === RESOURCE_ENERGY ? 10 : 100;
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

  get fleeLairTime(): number | undefined {
    return this.fromCache("fleeLairTime");
  }

  set fleeLairTime(value) {
    this.toCache("fleeLairTime", value);
  }

  get pos(): RoomPosition {
    const p = this.fromCache("pos");
    return new RoomPosition(p.x, p.y, p.roomName);
  }

  get ratePT() {
    if (this.resource instanceof Source)
      return this.resource.energyCapacity / ENERGY_REGEN_TIME;
    else if (this.operational) {
      const timeToChop =
        Math.max(
          this.master.activeBees.length
            ? _.max(this.master.activeBees, (b) => b.ticksToLive).ticksToLive
            : CREEP_LIFE_TIME,
          201
        ) - 200;
      return this.resource.mineralAmount / timeToChop;
    }
    return 0;
  }

  private updateStructure() {
    if (!(this.pos.roomName in Game.rooms)) return;

    this.container = _.filter(
      this.resource.pos.findInRange(FIND_STRUCTURES, 1),
      (s) => s.structureType === STRUCTURE_CONTAINER
    )[0] as StructureContainer;
    if (this.resource instanceof Source) {
      if (this.pos.roomName === this.hive.roomName) {
        this.link = _.filter(
          this.resource.pos.findInRange(FIND_MY_STRUCTURES, 2),
          (s) =>
            s.structureType === STRUCTURE_LINK &&
            s.isActive() &&
            (!this.hive.cells.upgrade ||
              !this.hive.cells.upgrade.link ||
              this.hive.cells.upgrade.link.id !== s.id)
        )[0] as StructureLink;
        if (!(this.hive.cells.storage && this.hive.cells.storage.link))
          this.link = undefined;
      }
      this.operational = !!(this.container || this.link);
    } else if (this.resource instanceof Mineral) {
      this.extractor = _.filter(
        this.resource.pos.lookFor(LOOK_STRUCTURES),
        (s) => s.structureType === STRUCTURE_EXTRACTOR && s.isActive()
      )[0] as StructureExtractor;
      this.operational = !!(
        this.extractor &&
        this.container &&
        !this.resource.ticksToRegeneration
      );
    }

    const roomInfo = Apiary.intel.getInfo(this.resource.pos.roomName, Infinity);

    if (this.container) this.pos = this.container.pos;
    if (this.link) {
      const poss = this.resource.pos.getOpenPositions(true);
      const pos = this.link.pos
        .getOpenPositions(true)
        .filter((p) => poss.filter((pp) => p.equal(pp)).length)[0];
      if (pos) this.pos = pos;
    }

    if (roomInfo.roomState === roomStates.SKfrontier) {
      this.lair = this.pos.findClosest(
        this.pos
          .findInRange(FIND_STRUCTURES, 5)
          .filter((s) => s.structureType === STRUCTURE_KEEPER_LAIR)
      ) as StructureKeeperLair | undefined;
      if (!this.fleeLairTime) this.recalcLairFleeTime();
    }

    const storagePos = this.parentCell.master
      ? this.parentCell.master.dropOff.pos
      : this.hive.pos;
    if (this.roadTime === Infinity || this.roadTime === null)
      this.roadTime = this.pos.getTimeForPath(storagePos);
    if (this.roadTime > 350) this.operational = false;
    if (this.restTime === Infinity || this.restTime === null)
      this.restTime = this.pos.getTimeForPath(this.hive.rest);
    if (this.operational) {
      if (this.hive.cells.dev) this.hive.cells.dev.shouldRecalc = true;
      this.parentCell.shouldRecalc = true;
    }
  }

  recalcLairFleeTime() {
    if (!this.lair) return;
    const path = Traveler.findTravelPath(this.pos, this.hive).path;
    let i = 0;
    for (; i < path.length; ++i)
      if (
        path[i].getRangeTo(this.lair) >
        Math.max(4, this.pos.getRangeTo(this.lair))
      )
        break;
    this.fleeLairTime = i + 2;
  }

  get loggerRef() {
    return "mining_" + this.resource.id.slice(this.resource.id.length - 4);
  }

  get loggerUpkeepRef() {
    return "upkeep_" + this.resource.id.slice(this.resource.id.length - 4);
  }

  update() {
    super.update(undefined, ["resource"]);

    if (this.operational) {
      if (!this.container && !this.link) this.operational = false;
      else if (
        this.resourceType !== RESOURCE_ENERGY &&
        this.resource.ticksToRegeneration
      ) {
        this.parentCell.shouldRecalc = true;
        this.operational = false;
      }
    } else if (Game.time % this.updateTime === 0) this.updateStructure();
  }

  run() {
    if (this.link && !this.link.cooldown) {
      const usedCap = this.link.store.getUsedCapacity(RESOURCE_ENERGY);
      if (usedCap >= LINK_CAPACITY / 4 && this.link.cooldown === 0) {
        const closeToFull = usedCap >= LINK_CAPACITY * 0.85;

        const fastRefLink =
          this.hive.cells.spawn.fastRef && this.hive.cells.spawn.fastRef.link;
        if (
          fastRefLink &&
          fastRefLink.store.getFreeCapacity(RESOURCE_ENERGY) >=
            LINK_CAPACITY / 8
        ) {
          const ans = this.link.transferEnergy(fastRefLink);
          if (ans === OK) {
            if (Apiary.logger)
              Apiary.logger.resourceTransfer(
                this.hive.roomName,
                this.loggerRef,
                this.link.store,
                fastRefLink.store,
                RESOURCE_ENERGY,
                1,
                { ref: this.loggerUpkeepRef, per: 0.03 }
              );
            return;
          }
        }

        const upgradeLink =
          this.hive.state === hiveStates.economy &&
          this.hive.cells.upgrade &&
          this.hive.cells.upgrade.master.beesAmount &&
          this.hive.cells.upgrade.link;
        if (
          upgradeLink &&
          (upgradeLink.store.getFreeCapacity(RESOURCE_ENERGY) >= usedCap ||
            (upgradeLink.store.getFreeCapacity(RESOURCE_ENERGY) >=
              LINK_CAPACITY / 8 &&
              !closeToFull))
        ) {
          const ans = this.link.transferEnergy(upgradeLink);
          if (ans === OK) {
            if (Apiary.logger)
              Apiary.logger.resourceTransfer(
                this.hive.roomName,
                this.loggerRef,
                this.link.store,
                upgradeLink.store,
                RESOURCE_ENERGY,
                1,
                { ref: this.loggerUpkeepRef, per: 0.03 }
              );
            return;
          }
        }

        const storageLink =
          this.hive.cells.storage && this.hive.cells.storage.link;
        if (
          storageLink &&
          (usedCap <= storageLink.store.getFreeCapacity(RESOURCE_ENERGY) ||
            closeToFull)
        ) {
          const ans = this.link.transferEnergy(storageLink);
          if (Apiary.logger && ans === OK)
            Apiary.logger.resourceTransfer(
              this.hive.roomName,
              this.loggerRef,
              this.link.store,
              storageLink.store,
              RESOURCE_ENERGY,
              1,
              { ref: this.loggerUpkeepRef, per: 0.03 }
            );
        }
      }
    }
  }
}
