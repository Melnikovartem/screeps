import { UpgradeCell } from "../../cells/stage1/upgradeCell";
import { Master } from "../_Master";

import { beeStates, prefix } from "../../enums";
import { setups } from "../../bees/creepsetups";

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
    this.fastModePossible = !!(this.cell.link && Object.keys(this.cell.sCell.links).length || this.cell.pos.getRangeTo(this.cell.sCell.storage) < 4);

    if (!(prefix.upgrade + this.hive.roomName in Game.flags)) {
      this.fastMode = false;
      this.boost = false;

      this.targetBeeCount = 1;
      this.patternPerBee = 2;
      return;
    }
    this.fastMode = true;
    this.boost = true;

    let storeAmount = this.cell.sCell.storage.store.getUsedCapacity(RESOURCE_ENERGY);
    // ceil(desiredRate) > 80 @ 390K aka ceil(desiredRate) > this.cell.maxRate almost everywhere
    let desiredRate = Math.min(this.cell.maxRate, Math.ceil(8.3 * Math.pow(10, -17) * Math.pow(storeAmount, 3) + 2.2 * Math.pow(10, -4) * storeAmount - 8.2))

    // ceil(desiredRate) === 0 @ 35K
    this.targetBeeCount = Math.ceil(desiredRate / this.cell.ratePerCreepMax);
    this.patternPerBee = Math.ceil(desiredRate / this.targetBeeCount);

    //this.targetBeeCount = Math.min(this.targetBeeCount, Math.ceil(
    //  1.7 * Math.pow(10, -18) * Math.pow(storeAmount, 3) + 1.4 * Math.pow(10, -5) * storeAmount - 0.5)); // cool math function
    if (this.cell.link)
      this.targetBeeCount = Math.min(this.targetBeeCount, this.cell.link.pos.getOpenPositions(true).filter(p => p.getRangeTo(this.cell.controller) <= 3).length)
  }


  checkBeesWithRecalc() {
    let check = () => this.checkBees(this.cell.controller.ticksToDowngrade < CREEP_LIFE_TIME * 2);
    if (this.targetBeeCount && !check())
      return false;
    this.recalculateTargetBee();
    return check();
  }

  update() {
    super.update();

    if (this.checkBeesWithRecalc()) {
      let order = {
        setup: setups.upgrader.manual.copy(),
        priority: <8 | 7 | 3>(this.cell.controller.level === 8 ? 8 : 7),
      };

      if (this.fastModePossible)
        order.setup = setups.upgrader.fast.copy();

      order.setup.patternLimit = this.patternPerBee;
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
        && bee.store.getUsedCapacity(RESOURCE_ENERGY) <= 25) || bee.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
        let suckerTarget;
        if (this.cell.link && this.cell.controller.ticksToDowngrade > CREEP_LIFE_TIME / 2) {
          let carryPart = bee.getActiveBodyParts(CARRY);
          if (carryPart === 1 || this.cell.link.store.getUsedCapacity(RESOURCE_ENERGY) >= carryPart * CARRY_CAPACITY)
            suckerTarget = this.cell.link;
        }
        if (!suckerTarget && this.cell.sCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 25000)
          suckerTarget = this.cell.sCell.storage;

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
