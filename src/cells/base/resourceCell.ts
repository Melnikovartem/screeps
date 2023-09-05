import { MinerMaster } from "beeMasters/economy/miner";
import type { Hive } from "hive/hive";
import { profile } from "profiler/decorator";
import { hiveStates, prefix, roomStates } from "static/enums";
import { Traveler } from "Traveler/TravelerModified";

import { Cell } from "../_Cell";
import type { ExcavationCell } from "./excavationCell";

const MAX_MINING_DIST = 200;

// cell that will extract energy or minerals? from ground <- i am proud with this smart comment i made at 1am
@profile
export class ResourceCell extends Cell {
  // #region Properties (12)

  public _fleeLairTime: number = this.cache("_fleeLairTime") || Infinity;
  public _restTime: number = this.cache("_restTime") || Infinity;
  public _roadTime: number = this.cache("_roadTime") || Infinity;
  public container?: StructureContainer;
  public extractor?: StructureExtractor;
  public lair?: StructureKeeperLair;
  public link?: StructureLink;
  public override master: MinerMaster;
  public parentCell: ExcavationCell;
  public poss: { x: number; y: number; roomName?: string };
  public resType: ResourceConstant = RESOURCE_ENERGY;
  public resource: Source | Mineral;

  // #endregion Properties (12)

  // #region Constructors (1)

  public constructor(
    hive: Hive,
    resource: Source | Mineral,
    excavationCell: ExcavationCell
  ) {
    super(hive, prefix.resourceCells + resource.id);
    this.resource = resource;

    this.poss = this.cache("poss") || this.resource.pos;

    if (resource instanceof Mineral) this.resType = resource.mineralType;
    this.parentCell = excavationCell;
    this.master = new MinerMaster(this);
  }

  // #endregion Constructors (1)

  // #region Public Accessors (13)

  public get fleeLairTime() {
    return this._fleeLairTime;
  }

  public set fleeLairTime(value) {
    this._fleeLairTime = this.cache("_fleeLairTime", value);
  }

  public get lairSoonSpawn() {
    return (
      this.lair &&
      (this.lair.ticksToSpawn || 0) <=
        (this.fleeLairTime !== Infinity ? this.fleeLairTime : 5) *
          (this.resType === RESOURCE_ENERGY ? 1 : 2) // mineral miners run SLOW
    );
  }

  public get loggerRef() {
    return "mining_" + this.resource.id.slice(this.resource.id.length - 4);
  }

  public get loggerUpkeepRef() {
    return "upkeep_" + this.resource.id.slice(this.resource.id.length - 4);
  }

  public get operational() {
    if (this.roadTime > MAX_MINING_DIST) return false;
    // energy source
    if (this.resType === RESOURCE_ENERGY)
      return !!this.link || !!this.container || !!this.hive.cells.dev;
    // mineral source
    return !!(
      (
        !!this.extractor &&
        !!this.container &&
        (this.resource.ticksToRegeneration || 0 < 10)
      ) // start beeing operational for 10ticks before
    );
  }

  public override get pos(): RoomPosition {
    return new RoomPosition(
      this.poss.x,
      this.poss.y,
      this.poss.roomName || this.hiveName
    );
  }

  public override set pos(value) {
    if (value.roomName !== this.hiveName) this.poss = value;
    else this.poss = { x: value.x, y: value.y };
    this.cache("poss", this.poss);
  }

  public get ratePT() {
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

  public get restTime() {
    return this._restTime;
  }

  public set restTime(value) {
    this._restTime = this.cache("_restTime", value);
  }

  public get roadTime() {
    return this._roadTime;
  }

  public set roadTime(value) {
    this._roadTime = this.cache("_roadTime", value);
  }

  // #endregion Public Accessors (13)

  // #region Public Methods (4)

  public recalcLairFleeTime() {
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

  public run() {
    if (!this.link || this.link.cooldown) return;

    const usedCap = this.link.store.getUsedCapacity(RESOURCE_ENERGY);
    if (usedCap < LINK_CAPACITY / 4) return;
    const closeToFull = usedCap >= LINK_CAPACITY * 0.85;

    const fastRefLink =
      this.hive.cells.spawn.fastRef && this.hive.cells.spawn.fastRef.link;
    if (
      fastRefLink &&
      fastRefLink.store.getFreeCapacity(RESOURCE_ENERGY) >= LINK_CAPACITY / 8
    ) {
      if (this.link.transferEnergy(fastRefLink) === OK)
        this.logLink(fastRefLink);
      return;
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
      if (this.link.transferEnergy(upgradeLink) === OK)
        this.logLink(upgradeLink);
      return;
    }

    const storageLink = this.hive.cells.storage.link;
    if (
      storageLink &&
      (usedCap <= storageLink.store.getFreeCapacity(RESOURCE_ENERGY) ||
        closeToFull)
    ) {
      if (this.link.transferEnergy(storageLink) === OK)
        this.logLink(storageLink);
    }
  }

  public update() {
    this.updateObject(undefined, ["resource"]);
    if (Apiary.intTime % (this.resType === RESOURCE_ENERGY ? 10 : 100) === 0)
      this.updateStructure();
  }

  // 0.1% chance to recalc time for road
  // so 10K ticks for energy and 100K ticks for mineral avg
  public updateRoadTime(force = Math.random() < 0.001) {
    const storagePos = this.parentCell.master
      ? this.parentCell.master.dropOff.pos
      : this.hive.pos;
    const roomState = Apiary.intel.getRoomState(this.pos);

    const recalcRoadTime = force || this.roadTime === Infinity;
    const recalcRestTime = force || this.restTime === Infinity;
    const recalcLairTime =
      roomState === roomStates.SKfrontier &&
      (force || this.fleeLairTime === Infinity);

    // will something change?
    if (
      this.operational &&
      (recalcRoadTime || recalcRestTime || recalcLairTime)
    )
      this.parentCell.shouldRecalc = true;

    if (recalcRoadTime) this.roadTime = this.pos.getTimeForPath(storagePos);
    if (recalcRestTime) this.restTime = this.pos.getTimeForPath(this.hive.rest);
    if (recalcLairTime) this.recalcLairFleeTime();
  }

  // #endregion Public Methods (4)

  // #region Private Methods (3)

  private logLink(linkTo: StructureLink) {
    if (!this.link) return;
    Apiary.logger.resourceTransfer(
      this.hiveName,
      this.loggerRef,
      this.link.store,
      linkTo.store,
      RESOURCE_ENERGY,
      1,
      { ref: this.loggerUpkeepRef, per: 0.03 }
    );
  }

  private updatePos() {
    let pos: RoomPosition = this.pos;
    if (this.container) pos = this.container.pos;
    if (this.link) {
      const poss = this.resource.pos.getOpenPositions();
      const posNearLink = this.link.pos
        .getOpenPositions()
        .filter((p) => poss.filter((pp) => p.equal(pp)).length);
      if (posNearLink.length)
        pos = posNearLink.reduce((prev, curr) =>
          this.pos.getRangeTo(prev) <= this.pos.getRangeTo(curr) ? prev : curr
        );
    }
    this.pos = pos;
  }

  private updateStructure() {
    this.updateRoadTime();
    if (!(this.pos.roomName in Game.rooms)) return;

    if (this.resType !== RESOURCE_ENERGY && this.extractor && this.container)
      return;

    if (
      this.resType === RESOURCE_ENERGY &&
      this.pos.roomName !== this.hiveName &&
      this.container
    )
      return;

    if (
      this.resType === RESOURCE_ENERGY &&
      this.pos.roomName === this.hiveName &&
      this.link
    )
      return;

    this.container = _.filter(
      this.resource.pos.findInRange(FIND_STRUCTURES, 1),
      (s) => s.structureType === STRUCTURE_CONTAINER
    )[0] as StructureContainer;

    if (this.resource instanceof Source) {
      if (this.pos.roomName === this.hiveName) {
        this.link = _.filter(
          this.resource.pos.findInRange(FIND_MY_STRUCTURES, 2),
          (s) =>
            s.structureType === STRUCTURE_LINK &&
            s.isActive() &&
            (!this.hive.cells.upgrade ||
              !this.hive.cells.upgrade.link ||
              this.hive.cells.upgrade.link.id !== s.id)
        )[0] as StructureLink;
        if (!this.hive.cells.storage.link) this.link = undefined;
      }
    } else if (this.resource instanceof Mineral) {
      this.extractor = _.filter(
        this.resource.pos.lookFor(LOOK_STRUCTURES),
        (s) => s.structureType === STRUCTURE_EXTRACTOR && s.isActive()
      )[0] as StructureExtractor;
    }

    this.updatePos();

    const roomState = Apiary.intel.getRoomState(this.pos);
    if (roomState !== roomStates.SKfrontier) return;

    this.lair = this.pos.findClosest(
      this.pos
        .findInRange(FIND_STRUCTURES, 5)
        .filter((s) => s.structureType === STRUCTURE_KEEPER_LAIR)
    ) as StructureKeeperLair | undefined;
  }

  // #endregion Private Methods (3)
}
