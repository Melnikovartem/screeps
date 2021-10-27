import { UpgradeCell } from "../../cells/stage1/upgradeCell";
import { Master } from "../_Master";

import { beeStates, prefix } from "../../enums";
import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";

@profile
export class UpgraderMaster extends Master {
  cell: UpgradeCell;
  patternPerBee = 0;
  fastModePossible = false;

  constructor(upgradeCell: UpgradeCell) {
    super(upgradeCell.hive, upgradeCell.ref);
    this.cell = upgradeCell;
  }

  recalculateTargetBee() {
    this.fastModePossible = !!(this.cell.link && Object.keys(this.cell.sCell.links).length || this.cell.pos.getRangeTo(this.cell.sCell.storage) < 4);

    if (!(prefix.upgrade + this.hive.roomName in Game.flags)) {
      this.boosts = undefined;

      this.targetBeeCount = 1;
      this.patternPerBee = 1;
      return;
    }
    this.boosts = [{ type: "upgrade", lvl: 2 }, { type: "upgrade", lvl: 1 }, { type: "upgrade", lvl: 0 }];

    let storeAmount = this.cell.sCell.storage.store.getUsedCapacity(RESOURCE_ENERGY);
    // ceil(desiredRate) > 80 @ ~602K aka ceil(desiredRate) > this.cell.maxRate almost everywhere
    let desiredRate = Math.min(this.cell.maxRate, Math.ceil(2.7 * Math.pow(10, -16) * Math.pow(storeAmount, 3) + 3.5 * Math.pow(10, -5) * storeAmount - 1));

    // ceil(desiredRate) === 0 @ ~30K
    this.targetBeeCount = Math.ceil(desiredRate / this.cell.ratePerCreepMax);
    this.patternPerBee = Math.ceil(desiredRate / this.targetBeeCount);

    //this.targetBeeCount = Math.min(this.targetBeeCount, Math.ceil(
    //  1.7 * Math.pow(10, -18) * Math.pow(storeAmount, 3) + 1.4 * Math.pow(10, -5) * storeAmount - 0.5)); // cool math function
    if (this.cell.link)
      this.targetBeeCount = Math.min(this.targetBeeCount, this.cell.link.pos.getOpenPositions(true).filter(p => p.getRangeTo(this.cell.controller) <= 3).length)
  }


  checkBeesWithRecalc() {
    this.recalculateTargetBee();
    return this.checkBees(this.cell.controller.ticksToDowngrade < CREEP_LIFE_TIME * 2)
  }

  update() {
    super.update();

    if (this.checkBeesWithRecalc()) {
      let upgrader;
      if (this.fastModePossible)
        upgrader = setups.upgrader.fast.copy();
      else
        upgrader = setups.upgrader.manual.copy();
      upgrader.patternLimit = this.patternPerBee;
      this.wish({
        setup: upgrader,
        priority: this.cell.controller.level === 8 ? 8 : 6,
      });
    }
  }

  getSucker(carryPart: number) {
    let suckerTarget;
    if (this.cell.link && this.cell.controller.ticksToDowngrade > CREEP_LIFE_TIME / 2) {
      if (carryPart === 1 || this.cell.link.store.getUsedCapacity(RESOURCE_ENERGY) >= carryPart * CARRY_CAPACITY)
        suckerTarget = this.cell.link;
    }
    if (!suckerTarget && this.cell.sCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 25000)
      suckerTarget = this.cell.sCell.storage;
    return suckerTarget;
  }

  run() {
    if (this.boosts)
      _.forEach(this.bees, bee => {
        if (bee.state === beeStates.boosting)
          if (!this.hive.cells.lab || this.hive.cells.lab.askForBoost(bee) === OK)
            bee.state = beeStates.chill;
      });

    _.forEach(this.activeBees, bee => {
      if (bee.state === beeStates.boosting)
        return;

      let carryPart = bee.getActiveBodyParts(CARRY);
      let old = bee.ticksToLive <= (bee.boosted ? (this.cell.roadTime * 4 + 5) : (carryPart === 1 ? 2 : this.cell.roadTime + 2));
      if (old && bee.ticksToLive > 2)
        old = !!(this.hive.cells.lab && this.hive.cells.lab.getUnboostLab());
      if (old) {
        if (bee.boosted && this.hive.cells.lab)
          bee.state = beeStates.fflush;
        else
          bee.state = beeStates.chill;
      } else if ((this.fastModePossible && this.cell.controller.ticksToDowngrade > CREEP_LIFE_TIME && bee.store.getUsedCapacity(RESOURCE_ENERGY) <= 25)
        || bee.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
        bee.withdraw(this.getSucker(carryPart), RESOURCE_ENERGY);
        bee.state = beeStates.work;
      }
      switch (bee.state) {
        case beeStates.fflush:
          if (!this.hive.cells.lab || !bee.boosted) {
            bee.state = beeStates.chill;
            break;
          }
          let lab = this.hive.cells.lab.getUnboostLab() || this.hive.cells.lab;
          bee.goRest(lab.pos);
          if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY))
            bee.transfer(this.getSucker(carryPart), RESOURCE_ENERGY);
          break;
        case beeStates.work:
          if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY)
            && bee.upgradeController(this.cell.controller) === OK && Apiary.logger)
            Apiary.logger.addResourceStat(this.hive.roomName, "upgrade", -bee.getActiveBodyParts(WORK));
          break;
        case beeStates.chill:
          if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
            if (!old)
              bee.state = beeStates.work;
            else
              bee.transfer(this.getSucker(carryPart), RESOURCE_ENERGY);
          bee.goRest(this.cell.pos);
          break;
      }
    });
  }
}
