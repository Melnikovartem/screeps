import type { buildingCostsHive } from "abstract/hiveMemory";
import type { CreepSetup } from "bees/creepSetups";
import { setups } from "bees/creepSetups";
import type { BuildCell } from "cells/building/buildCell";
import { wallMap } from "cells/building/hive-building";
import { HIVE_ENERGY, LOW_ENERGY } from "cells/management/storageCell";
import type { BoostRequest } from "cells/stage1/laboratoryCell";
import { BOOST_MINERAL } from "cells/stage1/laboratoryCell";
import { profile } from "profiler/decorator";
import { ZERO_COSTS_BUILDING_HIVE } from "static/constants";
import { beeStates, hiveStates } from "static/enums";
import { addResDict, findOptimalResource, getCase } from "static/utils";

import type { MovePriority } from "../_Master";
import { Master } from "../_Master";
import { findRamp } from "../war/siegeDefender";

const APPROX_DSIT = {
  hive: 15,
  annex: 60,
};

const BUILDING_SCALE = {
  /** stop spawning builders if below this */
  stop: -HIVE_ENERGY * 0.8,
  /** cap builders at max after this amount */
  max: 0,
  /** cap for scale */
  capEconomy: 3,
  /** maximum builders when small emergency */
  capEmergency: 3,
  /** maximum builders in battle */
  capBattle: 5,
};

/** how many can produce per 1 pattern */
export const BUILDING_PER_PATTERN: {
  boost: buildingCostsHive;
  normal: buildingCostsHive;
} = {
  boost: _.cloneDeep(ZERO_COSTS_BUILDING_HIVE),
  normal: _.cloneDeep(ZERO_COSTS_BUILDING_HIVE),
};

type B = keyof typeof BUILDING_PER_PATTERN;
type M = keyof (typeof BUILDING_PER_PATTERN)[B];
type R = keyof (typeof BUILDING_PER_PATTERN)[B][M];

const bakeBuildingCoefs = (boost: B, mode: M, repair: R) => {
  const buildingPower = repair === "repair" ? 1 : 5;
  const boostCoef = boost === "boost" ? 2 : 1;
  BUILDING_PER_PATTERN[boost][mode][repair] =
    Math.round(
      (CREEP_LIFE_TIME - 100) *
        (APPROX_DSIT[mode] / 25 + 1 / buildingPower) *
        boostCoef *
        1000
    ) / 1000;
};

for (const boost of ["boost", "normal"] as B[])
  for (const mode of ["hive", "annex"] as M[])
    for (const repair of ["repair", "build"] as R[])
      bakeBuildingCoefs(boost, mode, repair);

@profile
export class BuilderMaster extends Master<BuildCell> {
  // #region Properties (1)

  private patternPerBee = 0;

  // #endregion Properties (1)

  // #region Public Accessors (4)

  public override get boosts() {
    switch (this.hive.mode.buildBoost) {
      case 1:
        if (this.realBattle) return this.builderBoosts;
        break;
      case 2:
        if (this.realBattle || this.otherEmergency) return this.builderBoosts;
        break;
      case 3:
        return this.builderBoosts;
    }
    return [];
  }

  public get maxPatternBee() {
    return setups.builder
      .getBody(this.hive.room.energyCapacityAvailable)
      .body.filter((b) => b === WORK).length;
  }

  public get movePriority(): MovePriority {
    return this.hive.state === hiveStates.battle ? 4 : 5;
  }

  public get targetBeeCount() {
    const patternsNeeded = this.patternsNeeded;

    this.patternPerBee = setups.builder.patternLimit;
    if (this.realBattle || this.otherEmergency) {
      this.patternPerBee = Infinity;
      this.patternPerBee = Math.min(this.maxPatternBee, this.patternPerBee);
    }

    let target = patternsNeeded / this.patternPerBee;
    // @ todo scale bees with energy state

    let maxBees;

    if (this.hive.cells.dev) maxBees = this.hive.cells.dev.maxBuilderBeeCount;
    else if (this.realBattle) maxBees = BUILDING_SCALE.capBattle;
    else if (this.otherEmergency) maxBees = BUILDING_SCALE.capEmergency;
    else {
      const coef =
        (this.hive.getResState(RESOURCE_ENERGY) - BUILDING_SCALE.stop) /
        (BUILDING_SCALE.max - BUILDING_SCALE.stop);
      maxBees = Math.round(BUILDING_SCALE.capEconomy * Math.min(coef, 1));
    }

    if (target >= maxBees + 2) {
      // spawn big bees if not enough
      this.patternPerBee = this.maxPatternBee;
      target = patternsNeeded / this.patternPerBee;
    }

    return Math.min(Math.ceil(target), maxBees);
  }

  // #endregion Public Accessors (4)

  // #region Private Accessors (4)

  private get builderBoosts(): BoostRequest[] {
    return [
      { type: "build", lvl: 2 },
      { type: "build", lvl: 1 },
      { type: "build", lvl: 0 },
    ];
  }

  private get otherEmergency() {
    return (
      this.hive.state === hiveStates.nukealert ||
      this.parent.buildingCosts.hive.build / 5 +
        this.parent.buildingCosts.hive.repair >
        100_000
    );
  }

  private get patternsNeeded() {
    let patternsNeeded = 0;
    /** how much generations of bees to complete all buildings */
    let genToComplete = 1;

    if (this.hive.phase < 1) genToComplete = 0.25; // rush things
    else if (
      this.hive.phase === 2 &&
      this.hive.state === hiveStates.economy &&
      !this.parent.buildingCosts.hive.build &&
      !this.parent.buildingCosts.annex.build
    )
      genToComplete = 2; // no need to rush big projects

    const boost = this.boosts ? "boost" : "normal";
    for (const mode of ["hive", "annex"] as M[])
      for (const rr of ["repair", "build"] as R[])
        patternsNeeded +=
          this.parent.buildingCosts[mode][rr] /
          BUILDING_PER_PATTERN[boost][mode][rr] /
          genToComplete;

    return patternsNeeded;
  }

  private get realBattle() {
    return (
      this.hive.isBattle &&
      (this.parent.buildingCosts.hive.repair > 5_000 ||
        Apiary.intel.getInfo(this.hiveName, 20).dangerlvlmax >= 6)
    );
  }

  // #endregion Private Accessors (4)

  // #region Public Methods (2)

  public run() {
    const chill =
      this.hive.state !== hiveStates.battle &&
      (this.hive.storage?.store.getUsedCapacity(RESOURCE_ENERGY) || 0) <= 250;

    _.forEach(this.bees, (bee) => {
      if (bee.state === beeStates.boosting)
        if (this.boosts.length) {
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
            this.hive.cells.lab.boostBee(bee, boosts) === OK
          )
            bee.state = beeStates.chill;
        } else bee.state = beeStates.chill;
    });

    _.forEach(this.activeBees, (bee) => {
      if (this.hive.cells.defense.timeToLand < 50 && bee.ticksToLive > 50) {
        bee.fleeRoom(this.hiveName, this.hive.opt);
        return;
      }

      if (chill && !bee.store.getUsedCapacity(RESOURCE_ENERGY))
        bee.state = beeStates.chill;
      const old = bee.ticksToLive <= 25;
      if (old) bee.state = beeStates.fflush;

      const hive = !bee.pos.enteranceToRoom && Apiary.hives[bee.pos.roomName];
      const opt = (hive || this.hive).opt;

      let checkPos: (_: RoomPosition) => boolean = () => false;
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
        case beeStates.fflush: {
          this.recycleBee(bee);
          break;
        }
        case beeStates.refill: {
          const otherRes =
            bee.store.getUsedCapacity() >
            bee.store.getUsedCapacity(RESOURCE_ENERGY);
          if (otherRes) {
            const res = Object.keys(bee.store).filter(
              (r) => r !== RESOURCE_ENERGY
            )[0] as ResourceConstant | undefined;
            if (
              res &&
              this.hive.storage &&
              bee.transfer(this.hive.storage, res) === OK &&
              Apiary.logger
            )
              Apiary.logger.resourceTransfer(
                this.hiveName,
                "pickup",
                bee.store,
                this.hive.storage.store,
                res,
                1
              );
          }
          if (
            bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) ===
              bee.creep.store.getCapacity(RESOURCE_ENERGY) ||
            chill
          ) {
            bee.state = beeStates.work;
            break;
          } else if (
            this.hive.storage &&
            bee.withdraw(this.hive.storage, RESOURCE_ENERGY, undefined, opt) ===
              OK &&
            !otherRes
          ) {
            bee.state = beeStates.work;

            Apiary.logger.resourceTransfer(
              this.hiveName,
              this.hive.state === hiveStates.nukealert
                ? "defense_build"
                : "build",
              this.hive.storage.store,
              bee.store
            );
            const target = this.parent.getBuildTarget(bee);
            if (target) {
              bee.target = target.id;
              if (target.pos.getRangeTo(bee) > 3) bee.goTo(target.pos, opt);
            }
            break;
          }
          const resource = bee.pos.findInRange(FIND_DROPPED_RESOURCES, 1)[0];
          if (resource) bee.pickup(resource, opt);
          break;
        }
        case beeStates.work: {
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
                )
                  healTarget = wallMap(this.parent)[target.structureType];
                else healTarget = getCase(target).heal;

                if (target.hits >= Math.min(healTarget, target.hitsMax))
                  target = undefined;
              }
              if (
                target &&
                target.pos.roomName !== this.hiveName &&
                this.hive.annexInDanger.includes(target.pos.roomName)
              ) {
                target = undefined;
                bee.target = undefined;
              }
            }

            if (
              !target ||
              (Game.time % 25 === 0 && this.hive.isBattle) ||
              bee.pos.enteranceToRoom
            )
              target = this.parent.getBuildTarget(bee) || target;
            if (target) {
              if (
                this.hive.storage &&
                bee.pos.getRangeTo(this.hive.storage) <= 4 &&
                bee.store.getFreeCapacity() > 50 &&
                bee.pos.getRangeTo(target) > 4
              ) {
                bee.state = beeStates.refill;
                bee.goTo(this.hive.storage, opt);
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
          // fall through
        }
        case beeStates.chill:
          if (this.parent.structuresConst.length && !chill && !old)
            bee.state = beeStates.refill;
          else if (bee.store.getUsedCapacity() && this.hive.storage) {
            const res = findOptimalResource(bee.store);
            const ans = bee.transfer(this.hive.storage, res);
            if (ans === OK)
              Apiary.logger.resourceTransfer(
                this.hiveName,
                res === RESOURCE_ENERGY ? "build" : "pickup",
                bee.store,
                this.hive.storage.store,
                res,
                1
              );
            // bee.repairRoadOnMove(ans);
          } else
            bee.goRest(
              this.hive.isBattle ? this.hive.pos : this.hive.rest,
              opt
            );
          break;
      }
      if (bee.targetPosition && checkPos(bee.targetPosition)) bee.stop();
    });
  }

  public override update() {
    super.update();

    if (
      this.boosts.length &&
      this.hive.cells.lab &&
      this.hive.getUsedCapacity(BOOST_MINERAL.build[2]) >= LAB_BOOST_MINERAL
    )
      _.forEach(this.bees, (b) => {
        if (!b.boosted && b.ticksToLive >= 1200) b.state = beeStates.boosting;
      });

    const emergency = this.hive.state === hiveStates.nukealert;

    if (emergency)
      addResDict(
        this.hive.mastersResTarget,
        BOOST_MINERAL.build[2],
        MAX_CREEP_SIZE * LAB_BOOST_MINERAL
      );

    if (
      this.checkBees(
        this.hive.getUsedCapacity(RESOURCE_ENERGY) > LOW_ENERGY.low, // prevent creation of dev cells
        CREEP_LIFE_TIME - 90
      )
    ) {
      const order: {
        setup: CreepSetup;
        priority: 2 | 5 | 7;
      } = {
        setup: setups.builder,
        priority: emergency ? 2 : this.beesAmount ? 7 : 5,
      };
      order.setup.patternLimit = this.patternPerBee;
      // add a little secret spice if battle
      if (emergency || this.hive.isBattle)
        order.setup.fixed = [WORK, WORK, CARRY];
      this.wish(order);
    }
  }

  // #endregion Public Methods (2)
}
