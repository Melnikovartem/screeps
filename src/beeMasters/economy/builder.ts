import { Master } from "../_Master";

import { beeStates } from "../../enums";
import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";
import type { SpawnOrder, Hive } from "../../Hive";

@profile
export class BuilderMaster extends Master {

  constructor(hive: Hive) {
    super(hive, "BuilderHive_" + hive.room.name);
  }

  recalculateTargetBee() {
    let storage = this.hive.cells.storage && this.hive.cells.storage.storage;
    let constLen = this.hive.structuresConst.length;
    let constSum = this.hive.sumCost;
    if (!storage || constSum < 100 && constLen <= 1 || storage.store.getUsedCapacity(RESOURCE_ENERGY) < 10000)
      this.targetBeeCount = 0;
    else if (constSum < 13000 || storage.store.getUsedCapacity(RESOURCE_ENERGY) < 100000)
      this.targetBeeCount = 1;
    else if (constSum < 22000 || storage.store.getUsedCapacity(RESOURCE_ENERGY) < 300000)
      this.targetBeeCount = 2;
    else
      this.targetBeeCount = 3;
  }

  update() {
    super.update();
    this.recalculateTargetBee();
    if (this.checkBees()) {
      this.recalculateTargetBee();
      if (this.checkBees()) {
        let order: SpawnOrder = {
          setup: setups.builder,
          amount: 1,
          priority: 8,
        };
        this.wish(order);
      }
    }
  }

  run() {
    let storage = this.hive.cells.storage && this.hive.cells.storage.storage;
    if (!storage)
      return;
    _.forEach(this.activeBees, (bee) => {
      switch (bee.state) {
        case beeStates.refill:
          if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
            bee.state = beeStates.work;
          else if (bee.withdraw(storage, RESOURCE_ENERGY) === OK) {
            bee.state = beeStates.work;
            bee.target = null;
            if (Apiary.logger)
              Apiary.logger.resourceTransfer(this.hive.roomName, "build", storage!.store, bee.store);
            let target = bee.pos.findClosest(this.hive.structuresConst);
            if (target && target.pos.getRangeTo(bee) > 3)
              bee.goTo(target.pos);
          }
          break;
        case beeStates.work:
          if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0)
            bee.state = beeStates.refill;
          else {
            let target: Structure | ConstructionSite | null = null;
            if (bee.target) {
              target = Game.getObjectById(bee.target);
              if (target instanceof Structure && target.hits >= Apiary.planner.getCase(target).heal) {
                target = null;
              }
              if (!target && !this.hive.structuresConst.length && this.hive.shouldRecalc < 2)
                this.hive.shouldRecalc = 2;
            }

            if (!target) {
              let proj = bee.pos.findClosest(this.hive.structuresConst);
              while (proj && !target) {
                target = proj.pos.lookFor(LOOK_CONSTRUCTION_SITES)[0];
                if (!target)
                  target = _.filter(proj.pos.lookFor(LOOK_STRUCTURES).filter((s) => s.structureType === proj!.sType), (s) => s.hits < proj!.targetHits)[0];
                if (!target) {
                  for (let k = 0; k < this.hive.structuresConst.length; ++k)
                    if (this.hive.structuresConst[k].pos.x == proj.pos.x && this.hive.structuresConst[k].pos.y == proj.pos.y) {
                      this.hive.structuresConst.splice(k, 1);
                      break;
                    }
                  proj = bee.pos.findClosest(this.hive.structuresConst);
                }
              }
            }

            if (target) {
              let ans;
              if (target instanceof ConstructionSite)
                ans = bee.build(target);
              else if (target instanceof Structure)
                ans = bee.repair(target);
              bee.target = target.id;
              bee.repairRoadOnMove(ans);
            } else {
              bee.target = null;
              bee.state = beeStates.chill;
            }
          }
          if (bee.state !== beeStates.chill)
            break;
        case beeStates.chill:
          if (this.hive.sumCost)
            bee.state = beeStates.work;
          else if (bee.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            let ans = bee.transfer(storage, RESOURCE_ENERGY);
            if (ans === OK && Apiary.logger)
              Apiary.logger.resourceTransfer(this.hive.roomName, "build", bee.store, storage!.store, RESOURCE_ENERGY, 1);
            bee.repairRoadOnMove(ans);
          } else
            bee.goRest(this.hive.pos);
          break;
      }
    });
  }
}
