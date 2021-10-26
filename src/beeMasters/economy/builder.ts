import { Master } from "../_Master";

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

    this.boosts = undefined;

    if (this.hive.state >= hiveStates.nukealert || Apiary.orders[prefix.build + this.hive.roomName]
      || this.hive.wallsHealth < this.hive.wallsHealthMax && this.hive.resState[RESOURCE_ENERGY] > 0) {
      this.boosts = [{ type: "build", lvl: 2 }, { type: "build", lvl: 1 }, { type: "build", lvl: 0 }];
      this.patternPerBee = Infinity;
      ++target;
      if (this.hive.state === hiveStates.battle && this.hive.sumCost > 100000) {
        _.forEach(this.activeBees, b => {
          if (!b.boosted && b.ticksToLive > 1350)
            b.state = beeStates.boosting;
        });
        ++target;
      }
    } else if (this.hive.sumCost > 1200 && this.hive.state !== hiveStates.lowenergy) {
      this.patternPerBee = 5;
      if (this.hive.sumCost > 5000)
        ++target
      if (this.hive.sumCost > 15000) {
        this.boosts = [{ type: "build", lvl: 1 }, { type: "build", lvl: 0 }];
        if (this.sCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) > this.hive.resTarget[RESOURCE_ENERGY])
          this.patternPerBee = 8;
      }
    }

    this.targetBeeCount = target;
  }


  update() {
    super.update();
    let emergency = this.hive.state >= hiveStates.nukealert;


    this.recalculateTargetBee();
    this.movePriority = emergency ? 2 : 5;

    if (this.checkBees(this.sCell.getUsedCapacity(RESOURCE_ENERGY) > 10000)) {
      let order = {
        setup: setups.builder,
        priority: <2 | 5 | 8>(emergency ? 2 : (this.beesAmount ? 8 : 5)),
      };
      order.setup.patternLimit = this.patternPerBee;
      this.wish(order);
    }
  }

  run() {
    let chill = this.hive.state !== hiveStates.battle && this.sCell.getUsedCapacity(RESOURCE_ENERGY) < 2500;

    _.forEach(this.bees, bee => {
      if (bee.state === beeStates.boosting)
        if (this.boosts) {
          if (!this.hive.cells.lab || this.hive.cells.lab.askForBoost(bee, this.boosts
            .concat([{ type: "fatigue", lvl: 0, amount: Math.ceil(bee.getBodyParts(MOVE) / 2) }])) === OK)
            bee.state = beeStates.chill;
        } else
          bee.state = beeStates.chill;
    });

    _.forEach(this.activeBees, bee => {
      if (chill && !bee.store.getUsedCapacity(RESOURCE_ENERGY))
        bee.state = beeStates.chill;
      let old = bee.ticksToLive <= 25;
      if (old)
        if (bee.boosted && this.hive.cells.lab)
          bee.state = beeStates.fflush;
        else
          bee.state = beeStates.chill;

      switch (bee.state) {
        case beeStates.fflush:
          if (!this.hive.cells.lab || !bee.boosted) {
            bee.state = beeStates.chill;
            break;
          }
          let lab = this.hive.cells.lab.getUnboostLab() || this.hive.cells.lab;
          bee.goRest(lab.pos);
          break;
        case beeStates.refill:
          if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
            bee.state = beeStates.work;
          else if (bee.withdraw(this.sCell.storage, RESOURCE_ENERGY, undefined, this.hive.opts) === OK) {
            bee.state = beeStates.work;
            if (Apiary.logger)
              Apiary.logger.resourceTransfer(this.hive.roomName, this.hive.state === hiveStates.battle ? "defense" : "build", this.sCell.storage.store, bee.store);
            let target = bee.pos.findClosest(this.hive.structuresConst);
            if (target && target.pos.getRangeTo(bee) > 3)
              bee.goTo(target.pos, this.hive.opts);
            break;
          }
        case beeStates.work:
          if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            bee.state = beeStates.refill;
            bee.target = undefined;
          } else {
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

            if (!target || (this.hive.state === hiveStates.battle && Game.time % 10 === 0))
              target = this.hive.getBuildTarget(bee);
            if (target) {
              let ans;
              if (target instanceof ConstructionSite)
                ans = bee.build(target, this.hive.opts);
              else if (target instanceof Structure)
                ans = bee.repair(target, this.hive.opts);
              if (bee.pos.getRangeTo(target) <= 3 && this.hive.state == hiveStates.battle) {
                let resource = target.pos.lookFor(LOOK_RESOURCES).filter(r => r.resourceType === RESOURCE_ENERGY)[0];
                if (resource)
                  bee.pickup(resource, this.hive.opts);
              }
              bee.target = target.id;
              bee.repairRoadOnMove(ans);
            } else {
              bee.target = undefined;
              bee.state = beeStates.chill;
            }
          }
          if (bee.state !== beeStates.chill)
            break;
        case beeStates.chill:
          if (this.hive.structuresConst.length && !chill && !old)
            bee.state = beeStates.refill;
          else if (bee.store.getUsedCapacity(RESOURCE_ENERGY)) {
            let ans = bee.transfer(this.sCell.storage, RESOURCE_ENERGY);
            if (ans === OK && Apiary.logger)
              Apiary.logger.resourceTransfer(this.hive.roomName, "build", bee.store, this.sCell.storage.store, RESOURCE_ENERGY, 1);
            bee.repairRoadOnMove(ans);
          } else
            bee.goRest(this.hive.rest, this.hive.opts);
          break;
      }
      if (this.hive.state !== hiveStates.battle) {
        this.checkFlee(bee, this.hive);
      } else {
        let enemy = Apiary.intel.getEnemyCreep(bee, 25);
        if (enemy) {
          let fleeDist = Apiary.intel.getFleeDist(enemy);
          if (bee.targetPosition && enemy.pos.getRangeTo(bee.targetPosition) < fleeDist || enemy.pos.getRangeTo(bee.pos) <= fleeDist)
            bee.flee(enemy, this.hive);
        }
        if (!bee.targetPosition)
          bee.targetPosition = bee.pos;
      }
    });
  }
}
