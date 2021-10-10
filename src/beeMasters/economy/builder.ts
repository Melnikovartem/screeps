import { Master } from "../_Master";

import { beeStates, hiveStates } from "../../enums";
import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";
import type { Hive } from "../../Hive";
import type { StorageCell } from "../../cells/stage1/storageCell";

@profile
export class BuilderMaster extends Master {
  patternPerBee = 10;
  sCell: StorageCell;

  constructor(hive: Hive, sCell: StorageCell) {
    super(hive, "BuilderHive_" + hive.room.name);
    this.sCell = sCell;
  }

  recalculateTargetBee() {
    let target = this.hive.sumCost > 0 ? 1 : 0;
    this.patternPerBee = 5;

    if (this.hive.sumCost > 2500 && this.sCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) > this.hive.resTarget[RESOURCE_ENERGY]) {
      target = 2;
      this.patternPerBee = 10;
    }

    if (this.hive.state >= hiveStates.nukealert) {
      this.patternPerBee = Infinity;
      ++target;
    }

    this.targetBeeCount = target;
  }

  checkBeesWithRecalc() {
    let check = () => this.checkBees(this.hive.state === hiveStates.battle);
    if (!check())
      return false;
    this.recalculateTargetBee();
    return check();
  }

  update() {
    super.update();
    let emergency = this.hive.state >= hiveStates.nukealert;

    if (!this.boost && emergency)
      _.forEach(this.activeBees, b => b.state = beeStates.boosting);
    else if (this.boost && !emergency)
      _.forEach(this.activeBees, b => b.state = b.state === beeStates.boosting ? beeStates.chill : b.state);

    this.boost = emergency;
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
    let storage = this.hive.cells.storage && this.hive.cells.storage.storage;
    if (!storage)
      return;
    _.forEach(this.activeBees, bee => {
      switch (bee.state) {
        case beeStates.refill:
          if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
            bee.state = beeStates.work;
          else if (bee.withdraw(storage, RESOURCE_ENERGY) === OK) {
            bee.state = beeStates.work;
            delete bee.target;
            if (Apiary.logger)
              Apiary.logger.resourceTransfer(this.hive.roomName, this.hive.state === hiveStates.battle ? "defense" : "build", storage!.store, bee.store);
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
              if (target instanceof Structure && (target.hits >= Apiary.planner.getCase(target).heal || target.hits === target.hitsMax))
                target = undefined;
              if (!target && !this.hive.structuresConst.length && this.hive.shouldRecalc < 2)
                this.hive.shouldRecalc = 2;
            }

            if (!target)
              target = this.hive.findProject(bee, this.hive.state === hiveStates.battle ? "ignore_constructions" : undefined);

            if (target) {
              let ans;
              if (target instanceof ConstructionSite)
                ans = bee.build(target);
              else if (target instanceof Structure)
                ans = bee.repair(target);
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
        case beeStates.boosting:
          if (!this.hive.cells.lab
            || this.hive.cells.lab.askForBoost(bee, [{ type: "build" }, { type: "fatigue", amount: Math.ceil(bee.getActiveBodyParts(MOVE) / 3) }]) === OK)
            bee.state = beeStates.chill;
          break;
      }
    });
  }
}
