import { Master, CIVILIAN_FLEE_DIST } from "../_Master";

import { beeStates, hiveStates, prefix } from "../../enums";
import { setups } from "../../bees/creepsetups";
// import { findOptimalResource } from "../../abstract/utils";

import { profile } from "../../profiler/decorator";
import type { Hive } from "../../Hive";
import type { StorageCell } from "../../cells/stage1/storageCell";

@profile
export class BuilderMaster extends Master {
  patternPerBee = 10;
  sCell: StorageCell;

  constructor(hive: Hive, sCell: StorageCell) {
    super(hive, prefix.builder + hive.room.name);
    this.sCell = sCell;
  }

  recalculateTargetBee() {
    let target = this.hive.sumCost > 0 ? 1 : 0;
    this.patternPerBee = 3;

    if (this.hive.sumCost > 1200) {
      this.patternPerBee = 5;
      if (this.hive.sumCost > 5000)
        target = 2;
      if (this.hive.sumCost > 15000 && this.sCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) > this.hive.resTarget[RESOURCE_ENERGY])
        this.patternPerBee = 8;
    }

    if (this.hive.state >= hiveStates.nukealert) {
      this.patternPerBee = Infinity;
      ++target;
    }

    this.targetBeeCount = target;
  }

  checkBeesWithRecalc() {
    this.recalculateTargetBee();
    return this.checkBees(this.hive.state !== hiveStates.lowenergy);
  }

  update() {
    super.update();
    let emergency = this.hive.state >= hiveStates.nukealert;

    if (!this.boosts && emergency) {
      _.forEach(this.activeBees.filter(b => b.ticksToLive > 1000), b => b.state = beeStates.boosting);
      this.boosts = [{ type: "build" }, { type: "fatigue", lvl: 0 }];
    } else if (this.boosts && !emergency) {
      this.boosts = undefined;
      _.forEach(this.activeBees, b => b.state = b.state === beeStates.boosting ? beeStates.chill : b.state);
    }

    this.movePriority = emergency ? 1 : 5;

    if (this.checkBeesWithRecalc() || (emergency && !this.activeBees.length)) {
      let order = {
        setup: setups.builder,
        priority: <1 | 5 | 8>(emergency ? 1 : (this.beesAmount ? 8 : 5)),
      };
      order.setup.patternLimit = this.patternPerBee;
      this.wish(order);
    }
  }

  run() {
    let fleeDist = this.hive.state === hiveStates.battle ? 3 : CIVILIAN_FLEE_DIST;
    _.forEach(this.activeBees, bee => {

      let enemy = Apiary.intel.getEnemyCreep(bee, 25);
      let contr = Game.rooms[bee.pos.roomName].controller;
      if (enemy && (!contr || !contr.my || !contr.safeMode)) {
        enemy = Apiary.intel.getEnemyCreep(bee);
        if (enemy && enemy.pos.getRangeTo(bee) <= fleeDist)
          bee.state = beeStates.flee;
      }

      switch (bee.state) {
        case beeStates.refill:
          if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
            bee.state = beeStates.work;
          else if (bee.withdraw(this.sCell.storage, RESOURCE_ENERGY) === OK) {
            bee.state = beeStates.work;
            delete bee.target;
            if (Apiary.logger)
              Apiary.logger.resourceTransfer(this.hive.roomName, this.hive.state === hiveStates.battle ? "defense" : "build", this.sCell.storage.store, bee.store);
            let target = bee.pos.findClosest(this.hive.structuresConst);
            if (target && target.pos.getRangeTo(bee) > 3)
              bee.goTo(target.pos);
          }
          break;
        case beeStates.work:
          if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0)
            bee.state = beeStates.refill;
          else {
            let target: Structure | ConstructionSite | undefined | null;
            if (bee.target) {
              target = Game.getObjectById(bee.target);
              if (target instanceof Structure) {
                let healTarget;
                if (target.structureType === STRUCTURE_WALL || target.structureType === STRUCTURE_RAMPART) {
                  healTarget = this.hive.wallsHealth;
                  if (this.hive.state === hiveStates.battle)
                    healTarget *= 2;
                } else
                  healTarget = Apiary.planner.getCase(target).heal;
                if (target.hits >= Math.min(healTarget, target.hitsMax))
                  target = undefined;
              }
            }

            let opts: TravelToOptions = {};
            if (this.hive.state === hiveStates.battle) {
              opts.roomCallback = (roomName, matrix) => {
                if (roomName !== this.hive.roomName)
                  return;
                let enemies = Apiary.intel.getInfo(roomName).enemies.filter(e => e.dangerlvl > 1).map(e => e.object);
                _.forEach(enemies, c => {
                  _.forEach(c.pos.getOpenPositions(true, 3), p => matrix.set(p.x, p.y, 0xff));
                  matrix.set(c.pos.x, c.pos.y, 0xff);
                });
                return matrix;
              }
            }

            if (!target || this.hive.state === hiveStates.battle)
              target = this.hive.findProject(bee);

            if (target) {
              let ans;
              if (target instanceof ConstructionSite)
                ans = bee.build(target);
              else if (target instanceof Structure)
                ans = bee.repair(target);
              if (bee.pos.getRangeTo(target) <= 3) {
                let resource = target.pos.lookFor(LOOK_RESOURCES).filter(r => r.resourceType === RESOURCE_ENERGY)[0];
                if (resource)
                  bee.pickup(resource);
              }
              bee.target = target.id;
              bee.repairRoadOnMove(ans);
            } else {
              delete bee.target;
              bee.state = beeStates.chill;
            }
          }
          if (bee.state !== beeStates.chill)
            break;
        case beeStates.chill:
          if (this.hive.structuresConst.length)
            bee.state = beeStates.work;
          else if (bee.store.getUsedCapacity(RESOURCE_ENERGY)) {
            let ans = bee.transfer(this.sCell.storage, RESOURCE_ENERGY);
            if (ans === OK && Apiary.logger)
              Apiary.logger.resourceTransfer(this.hive.roomName, "build", bee.store, this.sCell.storage.store, RESOURCE_ENERGY, 1);
            bee.repairRoadOnMove(ans);
          } else
            bee.goRest(this.hive.rest);
          break;
        case beeStates.boosting:
          if (!this.hive.cells.lab
            || this.hive.cells.lab.askForBoost(bee) === OK)
            bee.state = beeStates.chill;
          break;
        case beeStates.flee:
          if (enemy && enemy.pos.getRangeTo(bee) < fleeDist)
            bee.flee(enemy, this.hive);
          bee.state = beeStates.work;
          break;
      }
    });
  }
}
