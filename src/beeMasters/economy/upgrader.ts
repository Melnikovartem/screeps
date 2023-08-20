import { setups } from "../../bees/creepSetups";
import { UpgradeCell } from "../../cells/stage1/upgradeCell";
import { beeStates, hiveStates } from "../../enums";
import { profile } from "../../profiler/decorator";
import { Master } from "../_Master";

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
    this.fastModePossible =
      !!(this.cell.link && this.cell.sCell.link) ||
      this.cell.pos.getRangeTo(this.cell.sCell.storage) < 4;

    const polen = this.hive.shouldDo("upgrade");
    if (
      !polen ||
      (polen === 1 && this.cell.controller.level === 8) ||
      this.hive.state >= hiveStates.nukealert
    ) {
      this.boosts = undefined;

      this.targetBeeCount =
        this.cell.controller.ticksToDowngrade <
        CONTROLLER_DOWNGRADE[this.cell.controller.level] * 0.75
          ? 1
          : 0;
      this.patternPerBee = 1;
      return;
    }

    if (polen != 2 || this.cell.controller.level < 8)
      this.boosts = [
        { type: "upgrade", lvl: 2 },
        { type: "upgrade", lvl: 1 },
        { type: "upgrade", lvl: 0 },
      ];

    const storeAmount =
      this.cell.sCell.storage.store.getUsedCapacity(RESOURCE_ENERGY);
    // ceil(desiredRate) > 80 @ ~602K aka ceil(desiredRate) > this.cell.maxRate almost everywhere
    let desiredRate = Math.min(
      this.cell.maxPossibleRate,
      this.cell.maxRate,
      Math.ceil(
        2.7 * Math.pow(10, -16) * Math.pow(storeAmount, 3) +
          3.5 * Math.pow(10, -5) * storeAmount -
          1
      )
    );

    if (
      this.cell.controller.level < 7 &&
      this.hive.resState[RESOURCE_ENERGY] > 0 &&
      this.hive.room.terminal
    )
      desiredRate = this.cell.maxRate; // can always buy / ask for more

    // ceil(desiredRate) === 0 @ ~30K
    const targetPrecise = desiredRate / this.cell.ratePerCreepMax;
    this.targetBeeCount = Math.min(Math.ceil(targetPrecise), this.cell.maxBees);
    this.patternPerBee = Math.round(
      (targetPrecise / this.targetBeeCount) * this.cell.workPerCreepMax
    );
  }

  checkBeesWithRecalc() {
    this.recalculateTargetBee();
    return this.checkBees(
      this.cell.controller.ticksToDowngrade <
        CONTROLLER_DOWNGRADE[this.cell.controller.level] * 0.5
    );
  }

  update() {
    super.update();

    if (this.checkBeesWithRecalc()) {
      let upgrader;
      if (this.fastModePossible) upgrader = setups.upgrader.fast.copy();
      else upgrader = setups.upgrader.manual.copy();
      upgrader.patternLimit = this.patternPerBee;
      this.wish({
        setup: upgrader,
        priority:
          this.cell.controller.level === 8 || this.beesAmount >= 2 ? 8 : 6,
      });
    }
  }

  run() {
    let suckerTarget:
      | StructureStorage
      | StructureLink
      | StructureTerminal
      | undefined;
    if (
      this.cell.link &&
      this.cell.controller.ticksToDowngrade > CREEP_LIFE_TIME / 2
    ) {
      if (this.cell.link.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
        suckerTarget = this.cell.link;
    } else if (
      this.cell.sCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 25000
    )
      suckerTarget = this.cell.sCell.storage;

    _.forEach(this.bees, (bee) => {
      if (bee.state === beeStates.boosting)
        if (!this.hive.cells.lab || this.hive.cells.lab.askForBoost(bee) === OK)
          bee.state = beeStates.chill;
    });

    _.forEach(this.activeBees, (bee) => {
      if (bee.state === beeStates.boosting) return;

      const carryPart = bee.getActiveBodyParts(CARRY);
      let old =
        bee.ticksToLive <=
        (bee.boosted
          ? this.cell.roadTime * 3 + 5
          : carryPart === 1
          ? 2
          : this.cell.roadTime + 2);
      if (
        old &&
        bee.ticksToLive > (carryPart === 1 ? 2 : this.cell.roadTime + 2)
      )
        old = !!(
          this.hive.cells.lab &&
          this.hive.cells.lab.getUnboostLab(bee.ticksToLive)
        );

      if (old) {
        if (bee.boosted && this.hive.cells.lab) bee.state = beeStates.fflush;
        else bee.state = beeStates.chill;
      } else if (
        (this.fastModePossible &&
          bee.store.getUsedCapacity(RESOURCE_ENERGY) < 50 &&
          this.cell.controller.ticksToDowngrade > CREEP_LIFE_TIME) ||
        bee.store.getUsedCapacity(RESOURCE_ENERGY) === 0
      ) {
        // let pos = target.pos.getOpenPositions(false).filter(p => p.getRangeTo(this.cell) <= 3)[0] || target;
        if (suckerTarget) bee.withdraw(suckerTarget, RESOURCE_ENERGY);
        bee.state = beeStates.work;
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
          if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY))
            if (
              bee.transfer(
                this.cell.link || this.cell.sCell.storage,
                RESOURCE_ENERGY
              ) === ERR_FULL
            )
              bee.drop(RESOURCE_ENERGY);
          break;
        case beeStates.work:
          if (
            bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) &&
            bee.upgradeController(this.cell.controller) === OK &&
            Apiary.logger
          )
            Apiary.logger.addResourceStat(
              this.hive.roomName,
              "upgrade",
              -Math.min(
                bee.getActiveBodyParts(WORK),
                this.cell.maxPossibleRate
              ),
              RESOURCE_ENERGY
            );
          break;
        case beeStates.chill:
          if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
            if (!old) bee.state = beeStates.work;
            else
              bee.transfer(
                this.cell.link || this.cell.sCell.storage,
                RESOURCE_ENERGY
              );
          else bee.goRest(this.cell.pos);
          break;
      }
      this.checkFlee(bee, this.hive);
    });
  }
}
