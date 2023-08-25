import { addResDict, findOptimalResource } from "abstract/utils";
import { CreepSetup, setups } from "bees/creepSetups";
import { BOOST_MINERAL, BoostRequest } from "cells/stage1/laboratoryCell";
import type { StorageCell } from "cells/stage1/storageCell";
import { beeStates, hiveStates, prefix } from "enums";
import type { Hive } from "Hive";
import { profile } from "profiler/decorator";

import { Master } from "../_Master";
import { findRamp } from "../war/siegeDefender";

@profile
export class BuilderMaster extends Master {
  private patternPerBee = 10;
  private sCell: StorageCell;

  public constructor(hive: Hive, sCell: StorageCell) {
    super(hive, prefix.builder + hive.room.name);
    this.sCell = sCell;
  }

  private get builderBoosts(): BoostRequest[] {
    return [
      { type: "build", lvl: 2 },
      { type: "build", lvl: 1 },
      { type: "build", lvl: 0 },
    ];
  }

  private recalculateTargetBee() {
    let target = this.hive.sumCost > 0 ? 1 : 0;
    this.patternPerBee = 3;

    const realBattle =
      this.hive.state === hiveStates.battle &&
      (this.hive.sumCost > 500 ||
        Apiary.intel.getInfo(this.hive.roomName, 20).dangerlvlmax >= 6);

    const otherEmergency =
      this.hive.state === hiveStates.nukealert ||
      (this.hive.wallsHealth < this.hive.wallsHealthMax &&
        this.hive.resState[RESOURCE_ENERGY] > 0) ||
      this.hive.sumCost > 50000;

    this.boosts = undefined;
    switch (this.hive.shouldDo("buildBoost")) {
      case 1:
        if (!realBattle) this.boosts = this.builderBoosts;
        break;
      case 2:
        if (realBattle || otherEmergency) this.boosts = this.builderBoosts;
        break;
      case 3:
        this.boosts = this.builderBoosts;
        break;
    }

    if (realBattle || otherEmergency) {
      this.patternPerBee = Infinity;
      ++target;
      if (
        this.boosts &&
        this.hive.cells.lab &&
        this.sCell.getUsedCapacity(BOOST_MINERAL.build[2]) >= LAB_BOOST_MINERAL
      )
        _.forEach(this.bees, (b) => {
          if (!b.boosted && b.ticksToLive >= 1200) b.state = beeStates.boosting;
        });
      const energyPerBee =
        setups.builder
          .getBody(this.hive.room.energyCapacityAvailable)
          .body.filter((b) => b === WORK).length *
        CREEP_LIFE_TIME *
        0.85;
      target = Math.min(
        Math.max(target, Math.ceil(this.hive.sumCost / energyPerBee)),
        target + 6
      );
    } else if (
      this.hive.sumCost > 1200 &&
      this.hive.state !== hiveStates.lowenergy
    ) {
      this.patternPerBee = 5;
      if (this.hive.sumCost > 5000) ++target;
      if (this.hive.sumCost > 10000)
        if (this.hive.resState[RESOURCE_ENERGY] > 0) this.patternPerBee = 8;
    }

    this.targetBeeCount = target;
  }

  public update() {
    super.update();
    const emergency =
      this.hive.state === hiveStates.nukealert ||
      this.sCell.storage instanceof StructureTerminal;

    this.recalculateTargetBee();
    this.movePriority = emergency ? 2 : 5;

    if (emergency)
      addResDict(
        this.hive.mastersResTarget,
        BOOST_MINERAL.build[2],
        MAX_CREEP_SIZE * LAB_BOOST_MINERAL
      );

    if (
      this.checkBees(
        this.sCell.getUsedCapacity(RESOURCE_ENERGY) > 10000,
        CREEP_LIFE_TIME - 20
      )
    ) {
      /* if (!this.hive.structuresConst.filter(cc => cc.pos.roomName === this.hive.roomName)) {
        let setup = setups.builder;
        setup = setup.copy();
        setup.pattern = [WORK, CARRY, CARRY];
      } */
      const order: {
        setup: CreepSetup;
        priority: 2 | 5 | 7;
      } = {
        setup: setups.builder,
        priority: emergency ? 2 : this.beesAmount ? 7 : 5,
      };
      order.setup.patternLimit = this.patternPerBee;
      this.wish(order);
    }
  }

  public run() {
    const chill =
      this.hive.state !== hiveStates.battle &&
      this.sCell.getUsedCapacity(RESOURCE_ENERGY) < 2500;

    _.forEach(this.bees, (bee) => {
      if (bee.state === beeStates.boosting)
        if (this.boosts) {
          let boosts = this.boosts;
          if (
            this.hive.state === hiveStates.battle ||
            this.hive.state === hiveStates.nukealert
          )
            boosts = boosts.concat([
              {
                type: "fatigue",
                lvl: 0,
                amount: Math.ceil(bee.getBodyParts(MOVE) / 2),
              },
            ]);
          if (
            !this.hive.cells.lab ||
            this.hive.cells.lab.askForBoost(bee, boosts) === OK
          )
            bee.state = beeStates.chill;
        } else bee.state = beeStates.chill;
    });

    _.forEach(this.activeBees, (bee) => {
      if (this.hive.cells.defense.timeToLand < 50 && bee.ticksToLive > 50) {
        bee.fleeRoom(this.hive.roomName, this.hive.opt);
        return;
      }

      if (chill && !bee.store.getUsedCapacity(RESOURCE_ENERGY))
        bee.state = beeStates.chill;
      const old = bee.ticksToLive <= 25;
      if (old)
        if (
          bee.boosted &&
          this.hive.cells.lab &&
          this.hive.cells.lab.getUnboostLab(bee.ticksToLive)
        )
          bee.state = beeStates.fflush;
        else bee.state = beeStates.chill;

      const hive = !bee.pos.enteranceToRoom && Apiary.hives[bee.pos.roomName];
      const opt = (hive || this.hive).opt;

      let checkPos = (_: RoomPosition) => false;
      if (
        !hive ||
        hive.state !== hiveStates.battle ||
        hive.cells.defense.isBreached
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
        const fleeDist = Apiary.intel.getFleeDist(enemy, 300);
        if (!bee.targetPosition && enemy.pos.getRangeTo(bee) <= fleeDist)
          bee.targetPosition = bee.pos;
        if (
          (bee.targetPosition && !findRamp(bee.targetPosition)) ||
          !findRamp(bee.pos)
        ) {
          if (
            enemy.pos.getRangeTo(bee.targetPosition || bee.pos) < fleeDist ||
            (enemy.pos.getRangeTo(bee.targetPosition || bee.pos) <
              fleeDist + 2 &&
              hive.cells.defense.wasBreached(
                enemy.pos,
                bee.targetPosition || bee.pos
              ))
          ) {
            bee.flee(hive.pos);
            if (bee.hits < bee.hitsMax) bee.target = undefined;
            return;
          }
        }
        checkPos = (pos) => enemy.pos.getRangeTo(pos) < fleeDist;
      }

      switch (bee.state) {
        case beeStates.fflush:
          if (!this.hive.cells.lab || !bee.boosted) {
            bee.state = beeStates.chill;
            break;
          }
          const lab =
            this.hive.cells.lab.getUnboostLab(bee.ticksToLive) ||
            this.hive.cells.lab;
          bee.goTo(lab.pos, { range: 1 });
          break;
        case beeStates.refill:
          const otherRes =
            bee.store.getUsedCapacity() >
            bee.store.getUsedCapacity(RESOURCE_ENERGY);
          if (otherRes) {
            const res = Object.keys(bee.store).filter(
              (r) => r !== RESOURCE_ENERGY
            )[0] as ResourceConstant | undefined;
            if (
              res &&
              bee.transfer(this.sCell.storage, res) === OK &&
              Apiary.logger
            )
              Apiary.logger.resourceTransfer(
                this.hive.roomName,
                "pickup",
                bee.store,
                this.sCell.storage.store,
                res,
                1
              );
          }
          if (
            bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) ===
              bee.creep.store.getCapacity(RESOURCE_ENERGY) ||
            this.sCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 2500
          ) {
            bee.state = beeStates.work;
            break;
          } else if (
            bee.withdraw(
              this.sCell.storage,
              RESOURCE_ENERGY,
              undefined,
              opt
            ) === OK &&
            !otherRes
          ) {
            bee.state = beeStates.work;
            if (Apiary.logger)
              Apiary.logger.resourceTransfer(
                this.hive.roomName,
                this.hive.state === hiveStates.nukealert
                  ? "defense_build"
                  : "build",
                this.sCell.storage.store,
                bee.store
              );
            const target = this.hive.getBuildTarget(bee);
            if (target) {
              bee.target = target.id;
              if (target.pos.getRangeTo(bee) > 3) bee.goTo(target.pos, opt);
            }
            break;
          }
          const resource = bee.pos.findInRange(FIND_DROPPED_RESOURCES, 1)[0];
          if (resource) bee.pickup(resource, opt);
          break;
        case beeStates.work:
          if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            bee.state = beeStates.refill;
            bee.target = undefined;
          } else {
            let target: Structure | ConstructionSite | undefined | null;
            if (bee.target) {
              target = Game.getObjectById(bee.target) as
                | Structure
                | ConstructionSite
                | undefined
                | null;
              if (target instanceof Structure) {
                let healTarget;
                if (
                  target.structureType === STRUCTURE_WALL ||
                  target.structureType === STRUCTURE_RAMPART
                ) {
                  healTarget = this.hive.wallsHealth;
                  if (
                    this.hive.state === hiveStates.battle ||
                    this.hive.state === hiveStates.nukealert
                  )
                    healTarget *= 2;
                } else healTarget = Apiary.planner.getCase(target).heal;
                if (target.hits >= Math.min(healTarget, target.hitsMax))
                  target = undefined;
              }
              if (
                target &&
                target.pos.roomName !== this.hive.roomName &&
                this.hive.annexInDanger.includes(target.pos.roomName)
              ) {
                target = undefined;
                bee.target = undefined;
              }
            }

            if (
              !target ||
              (Game.time % 25 === 0 &&
                (this.hive.state === hiveStates.battle ||
                  this.hive.state === hiveStates.nukealert)) ||
              bee.pos.enteranceToRoom
            )
              target = this.hive.getBuildTarget(bee) || target;
            if (target) {
              if (
                bee.pos.getRangeTo(this.sCell.storage) <= 4 &&
                bee.store.getFreeCapacity() > 50 &&
                bee.pos.getRangeTo(target) > 4
              ) {
                bee.state = beeStates.refill;
                bee.goTo(this.sCell.storage, opt);
                break;
              }
              let ans: ScreepsReturnCode | undefined;
              if (target instanceof ConstructionSite)
                ans = bee.build(target, opt);
              else if (target instanceof Structure)
                ans = bee.repair(target, opt);
              bee.target = target.id;
              if (this.hive.state !== hiveStates.battle)
                bee.repairRoadOnMove(ans);
              let resource;
              if (bee.pos.getRangeTo(target) <= 3) {
                resource = bee.pos.findClosest(
                  target.pos.findInRange(FIND_DROPPED_RESOURCES, 3)
                );
              } else
                resource = bee.pos.findInRange(FIND_DROPPED_RESOURCES, 1)[0];
              if (
                resource &&
                (!hive ||
                  hive.state !== hiveStates.battle ||
                  resource.pos
                    .findInRange(FIND_MY_STRUCTURES, 1)
                    .filter(
                      (s) =>
                        s.structureType === STRUCTURE_RAMPART && s.hits > 10000
                    ).length)
              )
                bee.pickup(resource, opt);
            } else {
              bee.target = undefined;
              bee.state = beeStates.chill;
            }
          }
          if (bee.state !== beeStates.chill) break;
        case beeStates.chill:
          if (this.hive.structuresConst.length && !chill && !old)
            bee.state = beeStates.refill;
          else if (bee.store.getUsedCapacity()) {
            const res = findOptimalResource(bee.store);
            const ans = bee.transfer(this.sCell.storage, res);
            if (ans === OK && Apiary.logger)
              Apiary.logger.resourceTransfer(
                this.hive.roomName,
                res === RESOURCE_ENERGY ? "build" : "pickup",
                bee.store,
                this.sCell.storage.store,
                res,
                1
              );
            // bee.repairRoadOnMove(ans);
          } else
            bee.goRest(
              this.hive.state >= hiveStates.battle
                ? this.hive.pos
                : this.hive.rest,
              opt
            );
          break;
      }
      if (bee.targetPosition && checkPos(bee.targetPosition)) bee.stop();
    });
  }
}
