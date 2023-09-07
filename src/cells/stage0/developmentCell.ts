import type { Master, MasterParent } from "beeMasters/_Master";
import { BUILDING_PER_PATTERN } from "beeMasters/economy/builder";
import { setups } from "bees/creepSetups";
import { TransferRequest } from "bees/transferRequest";
import type { ResourceCell } from "cells/base/resourceCell";
import type { Hive } from "hive/hive";
import { profile } from "profiler/decorator";
import { hiveStates, prefix, setupsNames } from "static/enums";

import { Cell } from "../_Cell";

// just to failsafe cap
const MAX_HAULERS_ON_TARGET = 8;

/** takes over in case of emergencies
 * // no spawn
 * // low lvl controller
 * // VERY low energy
 */
@profile
export class DevelopmentCell extends Cell {
  // #region Properties (2)

  private carryCapacity: number = CARRY_CAPACITY;

  // public override master: BootstrapMaster;
  public shouldRecalc: boolean = true;

  // #endregion Properties (2)

  // #region Constructors (1)

  public constructor(hive: Hive) {
    super(hive, prefix.developmentCell);
  }

  // #endregion Constructors (1)

  // #region Public Accessors (4)

  public get controller() {
    return this.hive.controller;
  }

  public get managerBeeCount() {
    let accumRoadTime = 0;

    _.forEach(this.hive.cells.excavation.resourceCells, (cell) => {
      let coef = Math.min(
        cell.ratePT,
        cell.master.ratePT * cell.master.beesAmount
      );
      if (!cell.container) coef = Math.max(coef - this.minerBeeCount(cell), 0);

      accumRoadTime +=
        (cell.roadTime + Math.max(cell.restTime, cell.roadTime, 100)) * coef;
    });

    if (this.controller.level > 2) {
      const upgCell = this.hive.cells.upgrade;
      accumRoadTime += upgCell.maxRate.local * upgCell.roadTime * 1.6;
      //  * 2 * 0.8 : 2 for trips, 0.8 for overhead
    }

    const body = setups.managerQueen.getBody(
      this.hive.room.energyCapacityAvailable
    ).body;
    this.carryCapacity =
      body.filter((b) => b === CARRY).length * CARRY_CAPACITY;

    let rounding = (x: number) => Math.round(x + 0.1);
    if (this.controller.level <= 2) rounding = (x) => Math.round(x);
    return rounding(accumRoadTime / this.carryCapacity);
  }

  // upper bound on upgraders
  public get maxUpgraderBeeCount() {
    const energyPerBee = this.hive.cells.upgrade.ratePerCreepMax;

    return this.sCell.master.beesAmount >= Math.ceil(this.managerBeeCount / 2)
      ? Math.round(this.hive.approxIncome / energyPerBee) + 1
      : 0;
  }

  // upper bound on builders
  public get maxBuilderBeeCount() {
    const energyPerBee =
      (BUILDING_PER_PATTERN.normal.hive.build *
        Math.max(
          this.hive.cells.build.master.maxPatternBee,
          setups.builder.patternLimit
        )) /
      CREEP_LIFE_TIME;

    // send all energy instead of upgrading to building
    return this.sCell.master.beesAmount >= Math.ceil(this.managerBeeCount / 2)
      ? Math.round(this.hive.approxIncome / energyPerBee) + 1
      : 0;
  }

  public override get pos() {
    return this.hive.controller.pos;
  }

  private swapBees(
    master1: Master<MasterParent>,
    master2: Master<MasterParent>,
    amount = Infinity,
    namespace = ""
  ) {
    // move 5 bee at a time
    amount = Math.min(amount, 5);
    let count = 0;
    while (master1.activeBees.length) {
      if (count >= amount) break;
      const bee = master1.activeBees.reduce((a, b) =>
        a.ref.includes(namespace) ? a : b
      );
      master1.removeBee(bee);
      master2.newBee(bee);
      ++count;
    }
    return count;
  }

  // #endregion Public Accessors (4)

  // #region Public Methods (3)

  public minerBeeCount(cell: ResourceCell) {
    if (cell.resource instanceof Mineral) return 0;
    const harvestAmount =
      Math.floor(
        this.hive.room.energyCapacityAvailable /
          (BODYPART_COST[WORK] + BODYPART_COST[MOVE] * 0.5)
      ) * HARVEST_POWER;
    let maxBees = Math.round(
      cell.resource.energyCapacity / ENERGY_REGEN_TIME / harvestAmount
    );
    // will be buidling and not mining
    const c = cell.master.construction;
    if (c && c.progressTotal - c.progress > 1_000) maxBees *= 2;
    return Math.max(
      Math.min(
        Math.floor(cell.resource.pos.getOpenPositions().length),
        maxBees
      ),
      1
    );
  }

  public run() {
    if (this.hive.phase > 0 && this.hive.state === hiveStates.economy)
      this.delete();
    if (Apiary.intTime % 10 !== 0) return;
    // here cause need to check for bees
    this.addResources();
  }

  public override update() {
    if (Apiary.intTime % 10 !== 0) return;
    const builder = this.hive.cells.build.master;
    const upgrader = this.hive.cells.upgrade.master;
    const upgTarget = upgrader.targetBeeCount;
    const buildTarget = builder.targetBeeCount;

    // how many bees to send help fomr upgraders to builders
    // (no more then 5)

    const buildBees =
      Math.min(
        Math.floor(
          this.hive.cells.build.sumCost /
            (BUILDING_PER_PATTERN.normal.hive.build * 0.5)
        ),
        5
      ) - builder.beesAmount;

    if (buildBees >= 1 && !upgTarget && buildTarget) {
      // send some upgraders to help with building
      this.swapBees(upgrader, builder, buildBees, setupsNames.builder);
      return;
    }
    // too many of builders send some to upgrade
    if (buildBees < 0 && builder.beesAmount > buildTarget * 1.5)
      this.swapBees(
        builder,
        upgrader,
        builder.beesAmount - buildTarget,
        setupsNames.upgrader
      );
  }

  // #endregion Public Methods (3)

  // #region Private Methods (2)

  private addResources() {
    _.forEach([this.hiveName].concat(this.hive.annexNames), (miningRoom) => {
      const room = Game.rooms[miningRoom];
      if (!room) return;

      _.forEach(this.hive.cells.excavation.resourceCells, (cell) => {
        if (cell.container)
          this.sCell.requestToStorage([cell.container], 4, RESOURCE_ENERGY);
      });

      _.forEach(room.find(FIND_DROPPED_RESOURCES), (r) => {
        if (r.resourceType === RESOURCE_ENERGY) this.sendToStorage(r);
      });

      // use storage from own room cause it can be not active?
      if (
        miningRoom !== this.hiveName ||
        this.hive.storage instanceof StructureSpawn
      )
        _.forEach(room.find(FIND_STRUCTURES), (s) => {
          if (
            s.structureType !== STRUCTURE_STORAGE &&
            s.structureType !== STRUCTURE_TERMINAL &&
            s.structureType !== STRUCTURE_CONTAINER
          )
            return;
          this.sendToStorage(s);
        });
    });
  }

  private sendToStorage(
    target: Resource | StructureContainer | StructureStorage | StructureTerminal
  ) {
    if (!this.hive.storage) return;
    let amount = 0;
    if (target instanceof Resource) amount = target.amount;
    else amount = target.store.getUsedCapacity(RESOURCE_ENERGY);
    // ignore super small piles
    if (amount <= CARRY_CAPACITY * 0.5) return;
    let it = 0;
    let ref = target.id + "_" + it;
    let existing = this.sCell.requests[ref];
    while (existing && it <= MAX_HAULERS_ON_TARGET) {
      // already an unused order for this just update amount
      if (!existing.beeProcess) {
        existing.amount = amount;
        return;
      } else if (!(target instanceof Resource)) {
        // some of the resource will be hauled out
        amount -= this.carryCapacity;
        if (amount <= CARRY_CAPACITY * 0.5) return;
      }
      ref = target.id + "_" + ++it;
      existing = this.sCell.requests[ref];
    }
    // reached cap
    if (existing) return;
    const request = new TransferRequest(
      ref,
      target,
      this.hive.storage,
      4,
      RESOURCE_ENERGY,
      amount
    );
    if (!request.isValid()) return;
    this.sCell.requests[ref] = request;
    return;
  }

  // #endregion Private Methods (2)
}
