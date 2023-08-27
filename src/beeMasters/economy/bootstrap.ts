import { setups } from "bees/creepSetups";
import type { DevelopmentCell } from "cells/stage0/developmentCell";
import { wallMap } from "hive/hive-building";
import { profile } from "profiler/decorator";
import { getCase } from "static/utils";
import { beeStates, hiveStates, roomStates } from "utils/enums";

import { Master } from "../_Master";
import { findRamp } from "../war/siegeDefender";

type workTypes =
  | "upgrade"
  | "repair"
  | "build"
  | "refill"
  | "chilling"
  | "mining"
  | "picking";
type extraTarget = Tombstone | Ruin | Resource | StructureStorage;

@profile
export class BootstrapMaster extends Master {
  private cell: DevelopmentCell;
  private count: { [key in workTypes]: number } = {
    upgrade: 0,
    repair: 0,
    build: 0,
    refill: 0,
    chilling: 0,
    mining: 0,
    picking: 0,
  };
  private patternCount = 0;
  private containerTargeting: {
    [id: string]: { current: number; max: number };
  } = {};
  private minRoadTime = 0;

  public constructor(developmentCell: DevelopmentCell) {
    super(developmentCell.hive, developmentCell.ref);

    this.cell = developmentCell;
  }

  public recalculateTargetBee() {
    this.targetBeeCount = 0;
    this.minRoadTime = Infinity;
    this.patternCount = Math.floor(
      this.hive.room.energyCapacityAvailable / 200
    );
    if (this.hive.bassboost)
      this.patternCount = Math.floor(
        this.hive.bassboost.room.energyCapacityAvailable / 200
      );
    if (setups.bootstrap.patternLimit)
      this.patternCount = Math.min(
        setups.bootstrap.patternLimit,
        this.patternCount
      );
    this.patternCount = Math.max(this.patternCount, 1);
    _.forEach(this.hive.cells.excavation.resourceCells, (cell) => {
      if (cell.resourceType !== RESOURCE_ENERGY || cell.restTime === Infinity)
        return;
      this.minRoadTime = Math.min(this.minRoadTime, cell.restTime);
      const cycleWithoutEnergy =
        (cell.roadTime - 2) * 2 +
        (this.hive.sumCost ? 10 : this.hive.phase > 0 ? 0 : 50);
      // energy produce per tick / energy a bee takes
      let energyPerTick = 10;
      const roomInfo = Apiary.intel.getInfo(this.cell.pos.roomName, 20);
      if (!roomInfo.currentOwner) energyPerTick = 5;
      else if (roomInfo.currentOwner !== Apiary.username) energyPerTick = 0;
      const openPos = (cell.resource || cell).pos.getOpenPositions(true).length;

      if (cell.operational) {
        const miningPower = Math.min(
          Math.floor((this.hive.room.energyCapacityAvailable - 50) / 150),
          setups.miner.energy.patternLimit
        );
        if (miningPower < 0) return;
        this.targetBeeCount +=
          Math.min(energyPerTick, miningPower * 2) /
          ((this.patternCount * CARRY_CAPACITY) / cycleWithoutEnergy);
        energyPerTick = Math.max(energyPerTick - miningPower * 2, 0);
      }

      const maxCycleByEnergy =
        energyPerTick /
        ((this.patternCount * CARRY_CAPACITY) / (cycleWithoutEnergy + 25));
      // * (cell.pos.roomName === this.hive.pos.roomName ? 1.5 : 0.5); // much higher chance to mine in same room then in faraway
      // amount of positions * bees can 1 position support
      const maxcycleByPos =
        openPos * (1 + cycleWithoutEnergy / (25 + cycleWithoutEnergy));
      this.targetBeeCount += Math.min(maxCycleByEnergy, maxcycleByPos);
    });

    this.targetBeeCount = Math.max(1, Math.ceil(this.targetBeeCount));
    if (this.hive.phase > 0 || this.hive.shouldDo("saveCpu"))
      this.targetBeeCount = Math.min(this.targetBeeCount, 2);
    if (this.minRoadTime === Infinity) this.minRoadTime = 0;
    if (this.cell.shouldRecalc) {
      this.cell.addResources();
      this.cell.shouldRecalc = false;
    }
  }

  private checkBeesWithRecalc() {
    if (
      this.count.chilling ||
      (this.hive.phase > 0 && this.hive.state === hiveStates.economy)
    )
      return false;
    const check = () =>
      this.checkBees(
        !this.hive.cells.defense.isBreached,
        CREEP_LIFE_TIME - this.minRoadTime - 10
      );
    if (this.targetBeeCount && !check()) return false;
    this.recalculateTargetBee();
    return check();
  }

  public update() {
    super.update();

    if (this.cell.shouldRecalc) this.recalculateTargetBee();

    this.beesAmount = Object.keys(this.bees).length;
    const usefulBees = _.filter(
      this.bees,
      (b) => b.getActiveBodyParts(CARRY) >= this.patternCount
    ).length;
    this.beesAmount =
      usefulBees +
      Math.ceil(
        (((this.beesAmount - usefulBees) *
          Math.max(0.5, this.patternCount - 1)) /
          this.patternCount) *
          0.9
      );

    if (this.checkBeesWithRecalc()) {
      this.wish({
        setup: setups.bootstrap,
        priority:
          this.beesAmount < Math.min(3, this.targetBeeCount * 0.35)
            ? 0
            : this.beesAmount > Math.max(8, this.targetBeeCount * 0.35)
            ? 8
            : 5,
      });
    }
  }

  public run() {
    const countCurrent: { [key in workTypes]: number } = {
      upgrade: 0,
      repair: 0,
      build: 0,
      refill: 0,
      chilling: 0,
      mining: 0,
      picking: 0,
    };

    const sources = _.filter(
      this.hive.cells.excavation.resourceCells,
      (cell) =>
        (!cell.master.beesAmount ||
          this.hive.room.energyCapacityAvailable <= 750) &&
        cell.resourceType === RESOURCE_ENERGY
    )
      .map((cell) => cell.resource as Source)
      .filter((s) => {
        const roomInfo = Apiary.intel.getInfo(s.pos.roomName, Infinity);
        return (
          roomInfo.roomState <= roomStates.noOwner &&
          (s.energy > this.patternCount * CARRY_CAPACITY ||
            s.ticksToRegeneration < 20)
        );
      });

    const targets: extraTarget[] = [];
    const containerTargetingCur: {
      [id: string]: { current: number; max: number };
    } = {};

    for (let i = 0; i < this.cell.handAddedResources.length; ++i) {
      const pos = this.cell.handAddedResources[i];
      if (!(pos.roomName in Game.rooms)) continue;
      let amount = 0;
      let target: extraTarget | undefined = pos
        .lookFor(LOOK_RESOURCES)
        .filter((r) => r.resourceType === RESOURCE_ENERGY && r.amount >= 25)[0];
      if (target) amount = target.amount;
      if (!target)
        target = pos
          .lookFor(LOOK_TOMBSTONES)
          .filter((r) => r.store.getUsedCapacity(RESOURCE_ENERGY) >= 25)[0];
      if (!target)
        target = pos
          .lookFor(LOOK_RUINS)
          .filter((r) => r.store.getUsedCapacity(RESOURCE_ENERGY) >= 25)[0];
      if (!target) {
        const structures = pos
          .lookFor(LOOK_STRUCTURES)
          .filter((s) => (s as StructureStorage).store) as StructureStorage[];
        if (!structures.length) {
          this.cell.handAddedResources.splice(i, 1);
          --i;
        } else
          target = structures.filter(
            (s) =>
              s.store.getUsedCapacity(RESOURCE_ENERGY) >= 50 &&
              (!this.hive.room.storage ||
                s.id !== this.hive.room.storage.id ||
                this.hive.state === hiveStates.nospawn)
          )[0];
      }

      if (
        target &&
        (this.hive.state !== hiveStates.battle || "structureType" in target)
      ) {
        if (!amount && !(target instanceof Resource))
          amount = target.store.getUsedCapacity(RESOURCE_ENERGY);
        containerTargetingCur[target.id] = {
          current: 0,
          max: Math.ceil(amount / (this.patternCount * CARRY_CAPACITY)),
        };
        if (!this.containerTargeting[target.id])
          this.containerTargeting[target.id] = containerTargetingCur[target.id];
        if (
          this.containerTargeting[target.id].current <
          this.containerTargeting[target.id].max
        )
          targets.push(target);
      }
    }

    let refillTargets: (StructureSpawn | StructureExtension)[] = _.map(
      this.hive.cells.spawn.spawns
    );
    refillTargets = _.filter(
      refillTargets.concat(_.map(this.hive.cells.spawn.extensions)),
      (structure) => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    );

    const opt = this.hive.opt;

    _.forEach(this.activeBees, (bee) => {
      switch (bee.state) {
        case beeStates.work:
          if (!bee.creep.store.getUsedCapacity(RESOURCE_ENERGY)) {
            bee.state = beeStates.refill;
            bee.target = undefined;
          }
          break;
        case beeStates.refill:
          if (!bee.creep.store.getFreeCapacity(RESOURCE_ENERGY)) {
            if (Apiary.logger)
              Apiary.logger.addResourceStat(
                this.roomName,
                "larva",
                bee.creep.store.getUsedCapacity(RESOURCE_ENERGY),
                RESOURCE_ENERGY
              );
            bee.state = beeStates.work;
            bee.target = undefined;
          }
          break;
        case beeStates.chill:
          if (bee.pos.roomName === this.roomName) bee.state = beeStates.refill;
          break;
      }

      let source: Source | null | undefined | extraTarget;
      let target: Structure | ConstructionSite | undefined | null;
      let workType: workTypes = "chilling";
      let oldTarget: workTypes = "chilling";
      let ans: ScreepsReturnCode | undefined;
      switch (bee.state) {
        case beeStates.refill:
          if (!bee.target) {
            source = bee.pos.findClosest(
              sources.filter(
                (s) =>
                  s.pos.getOpenPositions(false).length || s.pos.isNearTo(bee)
              )
            );
            if (source) bee.target = source.id;
          } else {
            source = Game.getObjectById(bee.target) as
              | Source
              | null
              | undefined
              | extraTarget;
            if (source instanceof Source) {
              const roomInfo = Apiary.intel.getInfo(
                source.pos.roomName,
                Infinity
              );
              if (
                roomInfo.currentOwner &&
                roomInfo.currentOwner !== Apiary.username
              )
                source = undefined;
            } else if (
              this.hive.state === hiveStates.battle &&
              source &&
              !("structureType" in source)
            )
              source = undefined;
          }

          if (!source || source instanceof Source) {
            const pickupTarget = bee.pos.findClosest(targets);
            if (
              pickupTarget &&
              this.containerTargeting[pickupTarget.id].current <
                this.containerTargeting[pickupTarget.id].max &&
              (!source ||
                bee.pos.getRangeApprox(pickupTarget) <
                  bee.pos.getRangeApprox(source) + 35)
            ) {
              source = pickupTarget;
              bee.target = source.id;
              ++this.containerTargeting[source.id].current;
            }
          }

          if (source instanceof Source) {
            if (source.energy === 0 && source.ticksToRegeneration > 20)
              bee.target = undefined;
            else {
              if (bee.pos.isNearTo(source)) bee.harvest(source);
              else {
                const pos = source.pos.getOpenPositions()[0];
                if (pos) {
                  opt.range = 0;
                  bee.goTo(pos, opt);
                } else if (bee.pos.getRangeTo(source) > 2)
                  bee.target = undefined;
              }
            }
            ++countCurrent.mining;
            break;
          } else if (source) {
            bee.target = source.id;
            if (!containerTargetingCur[source.id]) bee.target = undefined;
            else if (
              containerTargetingCur[source.id].current >
              this.containerTargeting[source.id].max
            )
              bee.target = undefined;

            if (bee.target) {
              if (containerTargetingCur[source.id])
                containerTargetingCur[source.id].current += 1;
              if (source instanceof Resource) bee.pickup(source, opt);
              else bee.withdraw(source, RESOURCE_ENERGY, undefined, opt);
            }
            ++countCurrent.picking;
            break;
          } else {
            if (bee.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
              bee.state = beeStates.work;
            else bee.state = beeStates.chill;
            bee.target = undefined;
          }
        case beeStates.chill:
          ++countCurrent.chilling;
          bee.goRest(this.hive.rest, opt);
          break;
        case beeStates.work:
          workType = "chilling";
          oldTarget = "chilling";

          if (
            this.hive.state !== hiveStates.battle ||
            bee.pos.roomName !== this.roomName
          ) {
            if (this.checkFlee(bee, this.hive)) return;
          } else {
            const enemies = Apiary.intel
              .getInfo(bee.pos.roomName, 20)
              .enemies.map((e) => e.object)
              .filter((e) => {
                if (!(e instanceof Creep)) return false;
                const stats = Apiary.intel.getStats(e).current;
                return !!(stats.dmgClose + stats.dmgRange);
              }) as Creep[];
            const enemy = bee.pos.findClosest(enemies);
            if (!enemy) return;
            const fleeDist = Apiary.intel.getFleeDist(enemy);
            if (!bee.targetPosition && enemy.pos.getRangeTo(bee) <= fleeDist)
              bee.targetPosition = bee.pos;
            if (
              (bee.targetPosition && !findRamp(bee.targetPosition)) ||
              !findRamp(bee.pos)
            ) {
              if (
                enemy.pos.getRangeTo(bee.targetPosition || bee.pos) <
                  fleeDist ||
                (enemy.pos.getRangeTo(bee.targetPosition || bee.pos) <
                  fleeDist + 2 &&
                  this.hive.cells.defense.wasBreached(
                    enemy.pos,
                    bee.targetPosition || bee.pos
                  ))
              ) {
                bee.flee(this.hive.pos);
                return;
              }
            }
          }

          if (bee.target) {
            target = Game.getObjectById(bee.target) as
              | Structure
              | ConstructionSite
              | undefined
              | null;
            if (target instanceof ConstructionSite) {
              oldTarget = "build";
              workType = "build";
            } else if (target instanceof Structure) {
              if (target.structureType === STRUCTURE_CONTROLLER) {
                oldTarget = "upgrade";
                if (!(target as StructureController).upgradeBlocked)
                  workType = "upgrade";
              } else if (
                target.structureType === STRUCTURE_SPAWN ||
                target.structureType === STRUCTURE_EXTENSION ||
                target.structureType === STRUCTURE_STORAGE ||
                target.structureType === STRUCTURE_TOWER
              ) {
                oldTarget = "refill";
                if (
                  (target as StructureStorage).store.getFreeCapacity(
                    RESOURCE_ENERGY
                  ) > 0
                )
                  workType = "refill"; // also can be different types of <Store>, so just storage for easy check
              } else {
                oldTarget = "repair";
                let healTarget;

                if (
                  target.structureType === STRUCTURE_WALL ||
                  target.structureType === STRUCTURE_RAMPART
                )
                  healTarget = wallMap(this.hive)[target.structureType];
                else healTarget = getCase(target).heal;

                if (target.hits < Math.min(healTarget, target.hitsMax))
                  workType = "repair";
              }
            }
            if (workType === "chilling") target = undefined;
            if (!target) {
              workType = "chilling";
              if (
                !this.hive.structuresConst.length &&
                this.hive.shouldRecalc < 2
              )
                this.hive.shouldRecalc = 2;
            }
          }

          if (!target) {
            const tt: StructureTower[] = _.filter(
              this.hive.cells.defense.towers,
              (structure) =>
                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 50
            );
            target = bee.pos.findClosest(tt);
            workType = "refill";
          }

          if (
            !target &&
            !this.cell.controller.upgradeBlocked &&
            this.cell.controller.ticksToDowngrade <=
              CONTROLLER_DOWNGRADE[this.cell.controller.level] / 2 &&
            this.count.upgrade === 0 &&
            !this.cell.controller.upgradeBlocked
          ) {
            target = this.cell.controller;
            workType = "upgrade";
          }

          if (!target && bee.pos.roomName !== this.roomName) {
            target = this.hive.getBuildTarget(bee, "ignoreRepair");
            if (target && target.pos.roomName !== bee.pos.roomName)
              target = null;
            if (target)
              if (target instanceof Structure) workType = "repair";
              else workType = "build";
          }

          const refillTarget = bee.pos.findClosest(refillTargets);
          if (
            refillTarget &&
            (!this.hive.cells.storage ||
              !this.hive.cells.storage.master.activeBees.length) &&
            (oldTarget === "refill" ||
              this.count.refill *
                CARRY_CAPACITY *
                Math.max(1, this.patternCount - 1) *
                0.8 <
                this.hive.room.energyCapacityAvailable -
                  this.hive.room.energyAvailable) &&
            !(
              target &&
              bee.pos.getRangeTo(target) <
                Math.min(bee.pos.getRangeTo(refillTarget), 10)
            )
          ) {
            target = refillTarget;
            workType = "refill";
          }

          const storage =
            this.hive.state !== hiveStates.battle &&
            this.hive.state !== hiveStates.nospawn &&
            this.hive.room.storage;
          if (
            storage &&
            storage.isActive() &&
            (!target ||
              bee.pos.getRangeTo(storage) + 5 < bee.pos.getRangeTo(target))
          ) {
            target = this.hive.room.storage;
            workType = "refill";
          }

          if (
            !target &&
            ((this.count.repair + this.count.build) * CARRY_CAPACITY * 2 <
              this.hive.sumCost ||
              this.hive.state >= hiveStates.battle)
          ) {
            target = this.hive.getBuildTarget(bee);
            if (
              target &&
              target.pos.roomName !== this.roomName &&
              bee.pos.getRoomRangeTo(target) > 1
            )
              target = null;
            if (target instanceof Structure) workType = "repair";
            else workType = "build";
          }

          if (!target) {
            target = this.cell.controller;
            workType = "upgrade";
          }
          if (workType === "repair") {
            ans = bee.repair(target as Structure, opt);
            if (ans === OK && Apiary.logger)
              Apiary.logger.addResourceStat(
                this.roomName,
                "build",
                -1,
                RESOURCE_ENERGY
              );
          } else if (workType === "build") {
            ans = bee.build(target as ConstructionSite, opt);
            if (ans === OK && Apiary.logger)
              Apiary.logger.addResourceStat(
                this.roomName,
                "build",
                -1,
                RESOURCE_ENERGY
              );
          } else if (workType === "refill")
            ans = bee.transfer(
              target as Structure,
              RESOURCE_ENERGY,
              undefined,
              opt
            );
          else if (workType === "upgrade") {
            ans = bee.upgradeController(target as StructureController, opt);
            if (ans === OK && Apiary.logger)
              Apiary.logger.addResourceStat(
                this.roomName,
                "upgrade",
                -bee.getActiveBodyParts(WORK),
                RESOURCE_ENERGY
              );
          }
          bee.repairRoadOnMove(ans);

          if (oldTarget !== workType) {
            --this.count[oldTarget];
            ++this.count[workType];
          }
          ++countCurrent[workType];
          bee.target = target.id;
          break;
      }
    });
    this.count = countCurrent;
    this.containerTargeting = containerTargetingCur;
  }
}
