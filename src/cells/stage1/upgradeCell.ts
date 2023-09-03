import { UpgraderMaster } from "beeMasters/economy/upgrader";
import { setups } from "bees/creepSetups";
import type { Hive } from "hive/hive";
import { profile } from "profiler/decorator";
import { hiveStates, prefix } from "static/enums";

import { Cell } from "../_Cell";

@profile
export class UpgradeCell extends Cell {
  // #region Properties (8)

  public link: StructureLink | undefined | null;
  public container: StructureContainer | undefined | null;
  public linkId: Id<StructureLink> | null = null;
  public override master: UpgraderMaster;
  public maxBees = 10;
  public maxRate = 1;
  public ratePerCreepMax = 1;
  public roadTime: number;
  public workPerCreepMax = 1;

  // #endregion Properties (8)

  // #region Constructors (1)

  public constructor(hive: Hive) {
    super(hive, prefix.upgradeCell);
    this.findStructures();
    let roadTime = this.cache("roadTime");
    if (roadTime === null) {
      roadTime = this.hive.pos.getTimeForPath(this);
      if (roadTime === Infinity) roadTime = 0;
      this.cache("roadTime", roadTime);
    }
    this.roadTime = roadTime;
    this.master = new UpgraderMaster(this);
  }

  // #endregion Constructors (1)

  // #region Public Accessors (4)

  public get controller() {
    return this.hive.controller;
  }

  public get maxPossibleRate() {
    // @todo add power creep buff check
    return this.controller.level === 8 ? 15 : Infinity;
  }

  public override get pos() {
    return this.controller.pos;
  }

  // #endregion Public Accessors (4)

  // #region Public Methods (3)

  public findStructures() {
    let link: typeof this.link =
      this.cache("linkId") && Game.getObjectById(this.cache("linkId")!);
    if (!link) {
      const links = this.pos
        .findInRange(FIND_MY_STRUCTURES, 3)
        .filter((s) => s.structureType === STRUCTURE_LINK);
      if (links.length)
        link = links.reduce((prev, curr) =>
          this.pos.getRangeTo(prev) <= this.pos.getRangeTo(curr) ? prev : curr
        ) as StructureLink;
      if (link) this.cache("linkId", link.id);
    }
    this.link = link;

    if (!link) {
      this.container = undefined;
      const containers = this.pos
        .findInRange(FIND_STRUCTURES, 3)
        .filter((s) => s.structureType === STRUCTURE_CONTAINER);
      if (containers.length)
        this.container = containers.reduce((prev, curr) =>
          this.pos.getRangeTo(prev) <= this.pos.getRangeTo(curr) ? prev : curr
        ) as StructureContainer;
    }
  }

  public run() {
    if (!this.master.beesAmount) return;
    if (
      this.link &&
      this.sCell.link &&
      this.sCell.linkState &&
      this.sCell.linkState.using === this.ref
    ) {
      const freeCap = this.link.store.getFreeCapacity(RESOURCE_ENERGY);
      if (freeCap < LINK_CAPACITY / 2) return;
      if (
        freeCap <= this.sCell.link.store.getUsedCapacity(RESOURCE_ENERGY) ||
        freeCap >= LINK_CAPACITY * 0.85
      ) {
        const amount = Math.min(
          freeCap,
          this.sCell.link.store.getUsedCapacity(RESOURCE_ENERGY)
        );
        if (
          !this.sCell.link.cooldown &&
          this.sCell.link.transferEnergy(this.link, amount) === OK
        )
          Apiary.logger.addResourceStat(
            this.hiveName,
            "upgrade",
            -amount * 0.03,
            RESOURCE_ENERGY
          );
      }
    }
  }

  public override update() {
    this.updateObject();

    // at creation time or while room is small each 2K ticks
    if (
      Apiary.intTime === 0 ||
      (this.controller.level < 8 && Math.random() < 0.0005)
    )
      this.recalculateRate();

    if (!this.master.beesAmount) return;

    const freeCap =
      this.link && this.link.store.getFreeCapacity(RESOURCE_ENERGY);
    if (freeCap && freeCap >= LINK_CAPACITY / 2) {
      if (this.sCell.link) {
        if (
          !this.sCell.master.activeBees.length ||
          this.hive.state === hiveStates.lowenergy
        )
          return;
        this.sCell.requestFromStorage(
          [this.sCell.link],
          freeCap >= LINK_CAPACITY - 100 ? 3 : 1,
          RESOURCE_ENERGY
        );
        if (!this.sCell.linkState || this.sCell.linkState.priority >= 1)
          this.sCell.linkState = {
            using: this.ref,
            priority: 1,
            lastUpdated: Game.time,
          };
      }
    }
  }

  // #endregion Public Methods (3)

  // #region Private Methods (1)

  public get suckerTarget() {
    if (this.link && this.sCell.link) return this.link;
    if (this.container) return this.container;
    return this.hive.storage;
  }

  public get fastModePossible() {
    return this.suckerTarget && this.pos.getRangeTo(this.suckerTarget) <= 3;
  }

  private recalculateRate() {
    const futureResourceCells = _.filter(
      Game.flags,
      (f) =>
        f.color === COLOR_YELLOW &&
        f.secondaryColor === COLOR_YELLOW &&
        f.memory.hive === this.hiveName
    );
    this.maxRate = Math.max(1, futureResourceCells.length) * 10;

    let setup;
    if (this.fastModePossible) setup = setups.upgrader.fast;
    else setup = setups.upgrader.manual;

    let suckerTime = 0;
    if (this.link && this.sCell.link) {
      this.maxRate = Math.min(
        800 / this.link.pos.getRangeTo(this.sCell.link),
        this.maxRate
      ); // how to get more in?
      _.forEach(this.hive.cells.excavation.resourceCells, (cell) => {
        if (cell.link)
          this.maxRate += Math.min(
            800 / this.link!.pos.getRangeTo(cell.link),
            cell.ratePT
          );
      });
    } else {
      const suckerTarget = this.suckerTarget;
      if (suckerTarget)
        suckerTime = Math.max(
          this.controller.pos.getTimeForPath(suckerTarget) * 2 - 3,
          0
        );
    }

    if (!setup) setup = setups.upgrader.manual;

    setup.patternLimit = Infinity;
    const body = setup.getBody(this.hive.room.energyCapacityAvailable).body;
    const carry = body.filter((b) => b === CARRY).length * CARRY_CAPACITY;
    const work = body.filter((b) => b === WORK).length;
    this.ratePerCreepMax = carry / (suckerTime + carry / work);
    this.workPerCreepMax = work;

    this.maxBees = 10;
    if (this.link)
      this.maxBees = this.link.pos
        .getOpenPositions(true)
        .filter((p) => p.getRangeTo(this.controller) <= 3).length;
    else if (this.container)
      this.maxBees =
        this.container.pos
          .getOpenPositions(true)
          .filter((p) => p.getRangeTo(this.controller) <= 3).length - 1; // max 8
  }

  // #endregion Private Methods (1)
}
