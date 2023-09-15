import { UpgraderMaster } from "beeMasters/economy/upgrader";
import { setups } from "bees/creepSetups";
import type { Hive } from "hive/hive";
import { profile } from "profiler/decorator";
import { APPROX_PROFIT_SOURCE } from "static/constants";
import { hiveStates, prefix } from "static/enums";

import { Cell } from "../_Cell";

const ABSOLUTE_MAX_RATE_UPGRADE = 40 * 8;

@profile
export class UpgradeCell extends Cell {
  // #region Properties (10)

  public container: StructureContainer | undefined | null;
  public link: StructureLink | undefined | null;
  public override master: UpgraderMaster;
  public maxBees = 10;
  public maxRate = {
    import: 20,
    local: 10,
  };
  public poss: RoomPosition;
  public prevLvl = this.controller.level;
  public ratePerCreepMax = 1;
  public roadTime: number;
  public workPerCreepMax = 1;

  // #endregion Properties (10)

  // #region Constructors (1)

  public constructor(hive: Hive) {
    super(hive, prefix.upgradeCell);
    let poss = this.cache("poss");
    if (!poss) {
      const openPositions = this.controller.pos
        .getOpenPositions(true, 2)
        .filter((p) => this.controller.pos.getRangeTo(p) === 2);
      if (openPositions.length)
        poss = openPositions.reduce((a, b) =>
          a.getOpenPositions().length >= b.getOpenPositions().length ? a : b
        );
      else poss = this.controller.pos;
    }
    this.poss = new RoomPosition(poss.x, poss.y, this.hiveName);

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

  // #region Public Accessors (5)

  public get controller() {
    return this.hive.controller;
  }

  public get fastModePossible() {
    return this.suckerTarget && this.pos.getRangeTo(this.suckerTarget) <= 3;
  }

  public get maxPossibleRate() {
    // @todo add power creep buff check
    return this.controller.level === 8 ? 15 : Infinity;
  }

  public override get pos() {
    return this.controller.pos;
  }

  public get suckerTarget() {
    if (this.hive.storage && this.pos.getRangeTo(this.hive.storage) <= 3)
      return this.hive.storage;
    if (this.link && this.sCell.link) return this.link;
    if (this.container) return this.container;
    return this.hive.storage;
  }

  // #endregion Public Accessors (5)

  // #region Public Methods (3)

  public findStructures() {
    let link = this.poss
      .lookFor(LOOK_STRUCTURES)
      .filter((s) => s.structureType === STRUCTURE_LINK)[0] as
      | StructureLink
      | undefined;
    if (!link) {
      const links = this.pos
        .findInRange(FIND_MY_STRUCTURES, 2)
        .filter((s) => s.structureType === STRUCTURE_LINK);
      if (links.length)
        link = links.reduce((prev, curr) =>
          this.pos.getRangeTo(prev) <= this.pos.getRangeTo(curr) ? prev : curr
        ) as StructureLink;
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
    this.updateObjects([]);

    if (this.prevLvl !== this.controller.level) {
      // Just upgraded a new lvl
      this.hive.cells.build.checkRoom();
    }
    this.prevLvl = this.controller.level;

    // at creation time or while room is small each 1.5K ticks (Math.random() < 0.0005)
    if (
      Apiary.intTime === 0 ||
      (this.controller.level < 8 && Apiary.intTime % CREEP_LIFE_TIME === 0)
    )
      this.recalculateRate();

    if (
      !this.master.beesAmount ||
      !this.sCell.master.activeBees.length ||
      this.hive.state === hiveStates.lowenergy
    )
      return;

    let freeCap = this.link && this.link.store.getFreeCapacity(RESOURCE_ENERGY);
    if (freeCap && freeCap >= LINK_CAPACITY / 2) {
      if (this.sCell.link) {
        this.sCell.requestFromStorage(
          [this.sCell.link],
          freeCap >= LINK_CAPACITY * 0.875 ? 1 : 3, // hurry 100 left
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
    freeCap =
      this.container && this.container.store.getFreeCapacity(RESOURCE_ENERGY);
    if (freeCap && freeCap >= CONTAINER_CAPACITY / 2) {
      this.sCell.requestFromStorage(
        [this.container!],
        freeCap >= CONTAINER_CAPACITY * 0.875 ? 1 : 3, // hurry 250 left
        RESOURCE_ENERGY
      );
    }
  }

  // #endregion Public Methods (3)

  // #region Private Methods (1)

  private recalculateRate() {
    const suckerTarget = this.suckerTarget;
    this.maxRate.local = 0;
    this.maxRate.import = 0;
    if (!suckerTarget) return;

    this.maxRate.local = this.hive.approxIncome;
    // to keep things civil with hauling
    this.maxRate.import = 100;

    const suckerTime = Math.max(
      (this.controller.pos.getTimeForPath(suckerTarget) - 3) * 2,
      0
    );

    let setup;
    if (this.fastModePossible) setup = setups.upgrader.fast;
    else setup = setups.upgrader.manual;

    if (suckerTarget.id === this.link?.id && this.sCell.link) {
      let linkLimit = LINK_CAPACITY / this.link.pos.getRangeTo(this.sCell.link);
      _.forEach(this.hive.cells.excavation.resourceCells, (cell) => {
        if (cell.link)
          linkLimit += Math.min(
            LINK_CAPACITY / this.link!.pos.getRangeTo(cell.link),
            APPROX_PROFIT_SOURCE.link
          );
      });
      this.maxRate.import = Math.max(this.maxRate.import, linkLimit);
      this.maxRate.local = Math.max(this.maxRate.local, linkLimit);
    } else if (suckerTarget instanceof StructureStorage)
      this.maxRate.import = ABSOLUTE_MAX_RATE_UPGRADE; // boost the shit out of this hive

    this.maxRate.import = Math.max(this.maxRate.import, this.maxRate.local);

    setup.patternLimit = Infinity;
    const body = setup.getBody(this.hive.room.energyCapacityAvailable).body;
    const carry = body.filter((b) => b === CARRY).length * CARRY_CAPACITY;
    const work = body.filter((b) => b === WORK).length;
    this.ratePerCreepMax = carry / (suckerTime + carry / work);
    this.workPerCreepMax = work;

    this.maxBees = 10;
    if (this.link)
      this.maxBees = this.link.pos
        .getOpenPositions()
        .filter((p) => p.getRangeTo(this.controller) <= 3).length;
    else if (this.container)
      this.maxBees =
        this.container.pos
          .getOpenPositions()
          .filter((p) => p.getRangeTo(this.controller) <= 3).length - 1; // max 8
  }

  // #endregion Private Methods (1)
}
