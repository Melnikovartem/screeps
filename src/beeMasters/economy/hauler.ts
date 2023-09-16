import type { Bee } from "bees/bee";
import { setups } from "bees/creepSetups";
import { FULL_CAPACITY } from "bugSmuggling/terminalNetwork";
import type { ExcavationCell } from "cells/base/excavationCell";
import { BASE_MINERALS } from "cells/stage1/laboratoryCell";
import { profile } from "profiler/decorator";
import { beeStates, hiveStates } from "static/enums";
import { findOptimalResource } from "static/utils";

import { Master } from "../_Master";

const STOP_HAULING_RESOURCES = FULL_CAPACITY;

@profile
export class HaulerMaster extends Master<ExcavationCell> {
  // #region Properties (9)

  private _targetBeeCount = 0;
  private accumRoadTime = 0;
  private minRoadTime: number = 0;
  private roadUpkeepCost: { [id: string]: number } = {};
  private targetMap: { [id: string]: string | undefined } = {};

  public override deleteBee = (ref: string) => {
    super.deleteBee(ref);
    delete this.roadUpkeepCost[ref];
  };
  public dropOff: StructureStorage;
  public movePriority = 5 as const;
  public override newBee = (bee: Bee) => {
    if (bee.state === beeStates.idle && bee.store.getUsedCapacity())
      bee.state = beeStates.work;
    super.newBee(bee);
  };

  // #endregion Properties (9)

  // #region Constructors (1)

  // | StructureContainer | StructureLink | StructureTerminal
  public constructor(
    excavationCell: ExcavationCell,
    storage: StructureStorage
  ) {
    super(excavationCell);
    this.dropOff = storage;
    this.recalculateTargetBee();
  }

  // #endregion Constructors (1)

  // #region Public Accessors (1)

  public get targetBeeCount() {
    return this._targetBeeCount;
  }

  // #endregion Public Accessors (1)

  // #region Public Methods (5)

  public checkBeesWithRecalc() {
    const check = () =>
      this.checkBees(
        hiveStates.battle !== this.hive.state || !this.beesAmount,
        CREEP_LIFE_TIME - this.minRoadTime - 10
      );
    // double check to be sure
    if (this.targetBeeCount && !check()) return false;
    this.recalculateRoadTime();
    this.recalculateTargetBee();
    return check();
  }

  public recalculateRoadTime() {
    this.accumRoadTime = 0; // roadTime * minePotential
    this.minRoadTime = Infinity;
    if (this.hive.phase >= 1)
      _.forEach(this.parent.resourceCells, (cell) => {
        if (
          cell.operational &&
          cell.roadTime !== Infinity &&
          cell.restTime !== Infinity &&
          cell.container &&
          !cell.link
        ) {
          let coef = cell.master.ratePT;
          // min to prevent the longest mining any extra cost
          if (cell.lair) coef += 600 / ENERGY_REGEN_TIME; // usual drop of source keeper if killed by my SK defender
          this.accumRoadTime +=
            (cell.roadTime + Math.max(cell.restTime, cell.roadTime)) * coef;
          if (cell.restTime < this.minRoadTime)
            this.minRoadTime = cell.restTime;
        }
      });
    if (this.minRoadTime === Infinity) this.minRoadTime = 0;
  }

  public recalculateTargetBee() {
    const body = setups.hauler.getBody(
      this.hive.room.energyCapacityAvailable
    ).body;
    this.parent.fullContainer = Math.min(
      CONTAINER_CAPACITY,
      body.filter((b) => b === CARRY).length * CARRY_CAPACITY
    );
    let rounding = (x: number) => Math.ceil(x);
    if (this.hive.state === hiveStates.lowenergy)
      rounding = (x) => Math.floor(x + 0.15);
    this._targetBeeCount = rounding(
      this.accumRoadTime / this.parent.fullContainer
    );
  }

  public run() {
    _.forEach(this.activeBees, (bee) => {
      if (this.hive.cells.defense.timeToLand < 50 && bee.ticksToLive > 50) {
        bee.fleeRoom(this.hiveName, this.hive.opt);
        return;
      }

      if (bee.state === beeStates.chill && bee.store.getUsedCapacity() > 0)
        bee.state = beeStates.work;
      let res: ResourceConstant;
      switch (bee.state) {
        case beeStates.refill: {
          if (!bee.target || !this.targetMap[bee.target]) {
            bee.state = beeStates.work;
            break;
          }

          const target = Game.getObjectById(bee.target) as
            | StructureContainer
            | undefined;

          if (!target) {
            this.targetMap[bee.target] = undefined;
            bee.target = undefined;
            if (bee.store.getUsedCapacity()) bee.state = beeStates.work;
            else bee.state = beeStates.chill;
            break;
          }

          const roomInfo = Apiary.intel.getInfo(target.pos.roomName, 20);
          if (!roomInfo.safePlace) {
            this.targetMap[bee.target] = undefined;
            bee.target = undefined;
            bee.state = beeStates.chill;
            break;
          }

          if (bee.pos.getRangeTo(target) > 3) {
            const opt = this.hive.opt;
            opt.offRoad = true;
            bee.goTo(target, opt);
            break;
          }

          // overproduction or energy from SK defenders
          let overproduction: Resource | Tombstone | undefined = target.pos
            .findInRange(FIND_DROPPED_RESOURCES, 3)
            .filter(
              (r) => r.pos.getRangeTo(bee) <= 2 || r.pos.getRangeTo(target) <= 1
            )[0];
          if (overproduction) bee.pickup(overproduction);
          else {
            overproduction = target.pos
              .findInRange(FIND_TOMBSTONES, 1)
              .filter((t) => t.store.getUsedCapacity() > 0)[0];
            if (overproduction)
              bee.withdraw(
                overproduction,
                findOptimalResource(overproduction.store)
              );
          }

          if (
            !bee.store.getFreeCapacity() ||
            (!overproduction &&
              bee.withdraw(target, findOptimalResource(target.store)) === OK &&
              Object.keys(target.store).length < 2)
          ) {
            this.targetMap[bee.target] = undefined;
            bee.state = beeStates.work;
            let source: Source | Mineral | null = bee.pos.findClosest(
              target.pos.findInRange(FIND_SOURCES, 1)
            );
            if (!source)
              source = bee.pos.findClosest(
                target.pos.findInRange(FIND_MINERALS, 1)
              );
            bee.target = source ? source.id : undefined;
          }
          break;
        }
        case beeStates.work: {
          res = findOptimalResource(bee.store);

          if (
            bee.store.getUsedCapacity(RESOURCE_ENERGY) > 0 &&
            bee.repairRoadOnMove() === OK
          )
            this.roadUpkeepCost[bee.ref]++;
          if (bee.store.getFreeCapacity() > 0) {
            const resource = bee.pos.lookFor(LOOK_RESOURCES)[0];
            if (resource) bee.pickup(resource);
          }

          const ans = bee.transfer(this.dropOff, res, undefined, this.hive.opt);
          if (ans === OK) {
            if (bee.target) {
              const source = Game.getObjectById(bee.target);
              let sameRes;
              if (source instanceof Source) sameRes = res === RESOURCE_ENERGY;
              else if (source instanceof Mineral)
                sameRes = source.mineralType === res;
              else
                sameRes =
                  res === RESOURCE_ENERGY || BASE_MINERALS.includes(res);

              const ref = sameRes
                ? "mining_" + bee.target.slice(bee.target.length - 4)
                : "pickup";

              Apiary.logger.addResourceStat(
                this.hiveName,
                ref,
                this.roadUpkeepCost[bee.ref],
                RESOURCE_ENERGY
              );
              Apiary.logger.addResourceStat(
                this.hiveName,
                sameRes
                  ? "upkeep_" + bee.target.slice(bee.target.length - 4)
                  : "build",
                -this.roadUpkeepCost[bee.ref],
                RESOURCE_ENERGY
              );
              this.roadUpkeepCost[bee.ref] = 0;
              Apiary.logger.resourceTransfer(
                this.hiveName,
                ref,
                bee.store,
                this.dropOff.store,
                res,
                1
              );
            }
          } else if (
            bee.pos.getRangeTo(this.hive) <= 8 &&
            bee.store.getUsedCapacity(RESOURCE_ENERGY) > 0
          ) {
            const ss = (
              bee.pos
                .findInRange(FIND_MY_STRUCTURES, 1)
                .filter(
                  (s) =>
                    s.structureType === STRUCTURE_EXTENSION ||
                    s.structureType === STRUCTURE_SPAWN
                ) as (StructureSpawn | StructureExtension)[]
            ).filter((s) => s.store.getFreeCapacity(RESOURCE_ENERGY))[0];

            if (ss && bee.transfer(ss, RESOURCE_ENERGY) === OK)
              if (bee.target) {
                const ref = "mining_" + bee.target.slice(bee.target.length - 4);
                Apiary.logger.resourceTransfer(
                  this.hiveName,
                  ref,
                  bee.store,
                  ss.store,
                  res,
                  1
                );
              }
          }

          if (!bee.store.getUsedCapacity()) {
            bee.state = beeStates.chill;
            bee.target = undefined;
          } else {
            break;
          }
          // fall through
        }
        case beeStates.chill:
          bee.goRest(this.hive.rest);
          // this.recycleBee(bee, { offRoad: true, ...this.hive.opt });
          break;
      }
      if (this.checkFlee(bee) && bee.targetPosition && bee.hits < bee.hitsMax) {
        const diff =
          bee.store.getUsedCapacity() -
          Math.floor(bee.store.getCapacity() * 0.5 + 50);
        if (diff > 0) bee.drop(findOptimalResource(bee.store), diff);
      }
    });
  }

  public override update() {
    super.update();

    if (!this.accumRoadTime || this.parent.shouldRecalc) {
      this._targetBeeCount = 0;
      if (Apiary.intTime % 190 === 0 || this.parent.shouldRecalc) {
        this.recalculateRoadTime();
        if (!this.accumRoadTime) return;
        this.recalculateTargetBee();
      } else return;
    }

    // dont haul resources if we are already full
    // failsafe
    if (
      this.dropOff.store.getFreeCapacity() <=
      Math.min(this.dropOff.store.getCapacity() * 0.01, STOP_HAULING_RESOURCES)
    )
      return;

    if (this.parent.shouldRecalc) {
      this.recalculateRoadTime();
      this.recalculateTargetBee();
    }

    if (this.checkBeesWithRecalc()) {
      this.wish({
        setup: setups.hauler,
        priority: this.beesAmount || this.waitingForBees ? 5 : 3,
      });
    }

    // find containers that need hauling
    // and find bees to haul
    _.forEach(this.parent.quitefullCells, (cell) => {
      const container = cell.container;
      if (!container) return;

      const target = this.targetMap[container.id];
      const oldBee = target && this.bees[target];
      if (oldBee && oldBee.target === container.id) return;

      const bee = container.pos.findClosest(
        _.filter(
          this.activeBees,
          (b) =>
            b.state === beeStates.chill &&
            // fancy way to calc cell.roadTime + cell.restTime
            b.ticksToLive >= cell.roadTime + b.pos.getRangeApprox(cell) + 30
        )
      );
      if (bee) {
        bee.state = beeStates.refill;
        bee.target = container.id;
        this.roadUpkeepCost[bee.ref] = 0;
        this.targetMap[container.id] = bee.ref;
      }
    });
  }

  // #endregion Public Methods (5)
}
