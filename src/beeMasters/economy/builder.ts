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

    if (this.hive.state >= hiveStates.nukealert || Apiary.orders[prefix.build + this.hive.roomName]) {
      this.boosts = [{ type: "build", lvl: 2 }, { type: "build", lvl: 1 }, { type: "build", lvl: 0 }];
      this.patternPerBee = Infinity;
      ++target;
    } else if (this.hive.sumCost > 1200 && this.hive.state !== hiveStates.lowenergy) {
      this.patternPerBee = 5;
      if (this.hive.sumCost > 5000)
        target = 2;
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

    if (this.checkBees(this.hive.state !== hiveStates.lowenergy)) {
      let order = {
        setup: setups.builder,
        priority: <2 | 5 | 8>(emergency ? 2 : (this.beesAmount ? 8 : 5)),
      };
      order.setup.patternLimit = this.patternPerBee;
      this.wish(order);
    }
  }

  run() {
    let opts: TravelToOptions = {};
    let chill = false;
    if (this.hive.state === hiveStates.battle) {
      opts.maxRooms = 1;
      opts.roomCallback = (roomName, matrix) => {
        if (roomName !== this.hive.roomName)
          return;
        let enemies = Apiary.intel.getInfo(roomName).enemies.filter(e => e.dangerlvl > 1).map(e => e.object);
        _.forEach(enemies, c => {
          _.forEach(c.pos.getOpenPositions(true, 4), p => matrix.set(p.x, p.y, Math.max(matrix.get(p.x, p.y), (5 - p.getRangeTo(c)) * 0x20)));
          matrix.set(c.pos.x, c.pos.y, 0xff);
        });
        return matrix;
      }
    } else if (this.sCell.getUsedCapacity(RESOURCE_ENERGY) < 2500)
      chill = true;

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

      switch (bee.state) {
        case beeStates.refill:
          if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
            bee.state = beeStates.work;
          else if (bee.withdraw(this.sCell.storage, RESOURCE_ENERGY, undefined, opts) === OK) {
            bee.state = beeStates.work;
            if (Apiary.logger)
              Apiary.logger.resourceTransfer(this.hive.roomName, this.hive.state === hiveStates.battle ? "defense" : "build", this.sCell.storage.store, bee.store);
            let target = bee.pos.findClosest(this.hive.structuresConst);
            if (target && target.pos.getRangeTo(bee) > 3)
              bee.goTo(target.pos, opts);
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

            if (!target || this.hive.state === hiveStates.battle)
              target = this.hive.getBuildTarget(bee);
            if (target) {
              let ans;
              if (target instanceof ConstructionSite)
                ans = bee.build(target, opts);
              else if (target instanceof Structure)
                ans = bee.repair(target, opts);
              if (bee.pos.getRangeTo(target) <= 3 && this.hive.state == hiveStates.battle) {
                let resource = target.pos.lookFor(LOOK_RESOURCES).filter(r => r.resourceType === RESOURCE_ENERGY)[0];
                if (resource)
                  bee.pickup(resource, opts);
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
          if (this.hive.structuresConst.length && !chill)
            bee.state = beeStates.refill;
          else if (bee.store.getUsedCapacity(RESOURCE_ENERGY)) {
            let ans = bee.transfer(this.sCell.storage, RESOURCE_ENERGY);
            if (ans === OK && Apiary.logger)
              Apiary.logger.resourceTransfer(this.hive.roomName, "build", bee.store, this.sCell.storage.store, RESOURCE_ENERGY, 1);
            bee.repairRoadOnMove(ans);
          } else
            bee.goRest(this.hive.rest, opts);
          break;
      }
      if (this.hive.state !== hiveStates.battle) {
        this.checkFlee(bee, this.hive);
      } else {
        let enemy = Apiary.intel.getEnemyCreep(bee, 25);
        if (enemy) {
          let fleeDist = Apiary.intel.getFleeDist(enemy);
          if (bee.targetPosition && enemy.pos.getRangeTo(bee.targetPosition) < fleeDist || enemy.pos.getRangeTo(bee.pos) < fleeDist)
            bee.flee(enemy, this.hive);
        }
        if (!bee.targetPosition)
          bee.targetPosition = bee.pos;
      }
    });
  }
}
