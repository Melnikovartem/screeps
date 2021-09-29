import { UpgradeCell } from "../../cells/stage1/upgradeCell";
import { Master } from "../_Master";

import { beeStates, prefix } from "../../enums";
import { setups } from "../../bees/creepsetups";
import { STORAGE_BALANCE } from "../../cells/stage1/storageCell";

import { profile } from "../../profiler/decorator";

@profile
export class UpgraderMaster extends Master {
  cell: UpgradeCell;
  patternPerBee = 0;
  fastMode = false;
  fastModePossible = false;

  constructor(upgradeCell: UpgradeCell) {
    super(upgradeCell.hive, upgradeCell.ref);
    this.cell = upgradeCell;
  }

  recalculateTargetBee() {
    let storageCell = this.hive.cells.storage;
    if (!storageCell) {
      this.targetBeeCount = 0;
      return;
    }

    this.fastModePossible = !!(this.cell.link && Object.keys(storageCell.links).length || this.cell.pos.getRangeTo(storageCell.storage) < 4);

    this.targetBeeCount = 1;
    this.patternPerBee = 10;
    this.boost = false;

    this.fastMode = true;
    if (!(prefix.upgrade + this.hive.roomName in Game.flags)) {
      this.fastMode = false;
      return;
    }

    this.boost = true;
    let desiredRate = this.cell.maxRate;
    let storeAmount = storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY)
    let rounding = Math.floor;
    if (storeAmount >= STORAGE_BALANCE[RESOURCE_ENERGY])
      rounding = Math.ceil;

    this.targetBeeCount = rounding(desiredRate / this.cell.ratePerCreepMax);
    this.patternPerBee = rounding(desiredRate / this.targetBeeCount);

    this.targetBeeCount = Math.max(1, this.targetBeeCount);
    this.targetBeeCount = Math.min(this.targetBeeCount, Math.ceil(
      1.7 * Math.pow(10, -18) * Math.pow(storeAmount, 3) + 1.4 * Math.pow(10, -5) * storeAmount - 0.5)); // cool math function
  }


  checkBeesWithRecalc() {
    let check = () => this.checkBees(this.cell.controller.ticksToDowngrade < CREEP_LIFE_TIME * 2);
    if (!check())
      return false;
    this.recalculateTargetBee();
    return check();
  }

  update() {
    super.update();

    if (this.checkBeesWithRecalc()) {
      let order = {
        setup: setups.upgrader.manual,
        amount: this.targetBeeCount - this.beesAmount,
        priority: <8 | 3>8,
      };

      if (this.fastModePossible)
        order.setup = setups.upgrader.fast;

      order.setup.patternLimit = this.patternPerBee;

      if (this.cell.controller.ticksToDowngrade < CREEP_LIFE_TIME * 2) {
        order.priority = 3;
        order.setup = setups.upgrader.manual;
      }

      this.wish(order);
    }
  }

  run() {
    if (this.boost)
      _.forEach(this.bees, bee => {
        if (bee.state === beeStates.boosting)
          if (!this.hive.cells.lab || this.hive.cells.lab.askForBoost(bee, [{ type: "upgrade" }]) === OK)
            bee.state = beeStates.chill;
      });

    _.forEach(this.activeBees, bee => {
      if (bee.state === beeStates.boosting)
        return;
      if ((this.fastModePossible && this.cell.controller.ticksToDowngrade > CREEP_LIFE_TIME
        && bee.store.getUsedCapacity(RESOURCE_ENERGY) <= 25 || bee.store.getUsedCapacity(RESOURCE_ENERGY) === 0)) {
        let suckerTarget;
        if (this.cell.link && this.cell.controller.ticksToDowngrade > CREEP_LIFE_TIME / 2)
          suckerTarget = this.cell.link;
        if (!suckerTarget) {
          let storage = this.hive.cells.storage && this.hive.cells.storage.storage;
          if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 10000)
            suckerTarget = storage;
        }
        let ans = bee.withdraw(suckerTarget, RESOURCE_ENERGY);
        switch (ans) {
          case OK:
            bee.state = beeStates.work;
            break;
          case ERR_NOT_FOUND:
            bee.state = beeStates.chill;
            break;
          default:
            bee.state = beeStates.refill;
            break;
        }
      }

      switch (bee.state) {
        case beeStates.work:
          if (bee.upgradeController(this.cell.controller) === OK && Apiary.logger)
            Apiary.logger.addResourceStat(this.hive.roomName, "upgrade", -bee.getActiveBodyParts(WORK));
          break;
        case beeStates.chill:
          if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
            bee.state = beeStates.work;
          bee.goRest(this.cell.pos);
          break;
        case beeStates.refill:
          if (bee.store.getFreeCapacity(RESOURCE_ENERGY) === 0)
            bee.state = beeStates.work;
      }
    });
  }
}
