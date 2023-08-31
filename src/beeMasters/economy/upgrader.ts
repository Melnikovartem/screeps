import { HIVE_ENERGY } from "cells/stage1/storageCell";

import { setups } from "../../bees/creepSetups";
import { UpgradeCell } from "../../cells/stage1/upgradeCell";
import { profile } from "../../profiler/decorator";
import { beeStates, hiveStates } from "../../static/enums";
import { Master } from "../_Master";

const UPGRADING_AFTER_8_ENERGY = HIVE_ENERGY; // double the amount to start upgrading

@profile
export class UpgraderMaster extends Master {
  private cell: UpgradeCell;
  private patternPerBee = 0;

  public constructor(upgradeCell: UpgradeCell) {
    super(upgradeCell.hive, upgradeCell.ref);
    this.cell = upgradeCell;
  }

  public get fastModePossible() {
    return (
      !!(this.cell.link && this.cell.sCell.link) ||
      this.cell.pos.getRangeTo(this.cell.sCell.storage) < 4
    );
  }

  private recalculateTargetBee() {
    const upgradeMode = this.hive.mode.upgrade; // polen

    // booring bees when we just try to be stable
    if (
      upgradeMode === 0 ||
      (upgradeMode === 1 && this.cell.controller.level === 8) // spawn even when nuke
    )
      this.boosts = undefined;

    // boost upto 8 default mode (2)
    if (
      upgradeMode === 3 ||
      (this.cell.controller.level < 8 && upgradeMode > 0)
    )
      this.boosts = [
        { type: "upgrade", lvl: 2 },
        { type: "upgrade", lvl: 1 },
        { type: "upgrade", lvl: 0 },
      ];
    else this.boosts = undefined;

    const storeAmount =
      this.cell.sCell.storage.store.getUsedCapacity(RESOURCE_ENERGY);

    let desiredRate = 0;
    if (
      this.cell.controller.level < 7 &&
      this.hive.resState[RESOURCE_ENERGY] > 0 &&
      this.hive.room.terminal
    )
      desiredRate = this.cell.maxRate; // can always buy / ask for more
    else if (this.cell.controller.level < 7)
      desiredRate = Math.min(
        this.cell.maxRate,
        Math.ceil(
          2.7 * Math.pow(10, -16) * Math.pow(storeAmount, 3) +
            3.5 * Math.pow(10, -5) * storeAmount -
            1
        ) // some math i pulled out of my ass ?? why tho
      );
    else if (
      upgradeMode >= 2 &&
      this.hive.resState.energy > UPGRADING_AFTER_8_ENERGY
    )
      desiredRate = this.cell.maxRate; // upgrade for GCL

    // failsafe (kidna but no)
    if (
      !desiredRate &&
      this.cell.controller.ticksToDowngrade <
        CONTROLLER_DOWNGRADE[this.cell.controller.level] * 0.5
    )
      desiredRate = 2; // enought to fix anything

    // we save smth for sure here
    if (upgradeMode === 0) desiredRate = Math.min(desiredRate, 1);

    const targetPrecise =
      Math.min(desiredRate, this.cell.maxPossibleRate) /
      this.cell.ratePerCreepMax;
    this.targetBeeCount = Math.min(Math.ceil(targetPrecise), this.cell.maxBees);
    this.patternPerBee = Math.round(
      (targetPrecise / this.targetBeeCount) * this.cell.workPerCreepMax
    );
  }

  private checkBeesWithRecalc() {
    this.recalculateTargetBee();
    return this.checkBees(
      this.cell.controller.ticksToDowngrade <
        CONTROLLER_DOWNGRADE[this.cell.controller.level] * 0.5
    );
  }

  public update() {
    super.update();

    if (this.checkBeesWithRecalc()) {
      let upgrader;
      if (this.fastModePossible) {
        upgrader = setups.upgrader.fast.copy();
        if (this.cell.controller.level === 8 && this.hive.mode.upgrade >= 2)
          upgrader.fixed = [CARRY, CARRY, CARRY]; // save some cpu on withdrawing
      } else upgrader = setups.upgrader.manual.copy();
      upgrader.patternLimit = this.patternPerBee;
      this.wish({
        setup: upgrader,
        priority:
          this.cell.controller.level === 8 || this.beesAmount >= 2 ? 8 : 6,
      });
    }
  }

  protected get suckerTarget(): StructureStorage | StructureLink | undefined {
    if (this.cell.link) {
      if (this.cell.link.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
        return this.cell.link;
    } else if (
      this.cell.sCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 25000
    )
      return this.cell.sCell.storage;
    return undefined;
  }

  public run() {
    const suckerTarget = this.suckerTarget;

    this.preRunBoost();

    _.forEach(this.activeBees, (bee) => {
      if (bee.state === beeStates.boosting) return;

      const carryPart = bee.getActiveBodyParts(CARRY);
      const old =
        bee.ticksToLive <=
        (bee.boosted
          ? this.cell.roadTime * 3 + 5
          : carryPart <= 3
          ? 2
          : this.cell.roadTime + 10);

      if (old) {
        // if any energy store it else go recycle yourself
        if (bee.store.getUsedCapacity(RESOURCE_ENERGY))
          bee.state = beeStates.chill; // now save energy normal way
        else bee.state = beeStates.fflush; // recycle boosts
      } else if (
        (this.fastModePossible &&
          bee.store.getUsedCapacity(RESOURCE_ENERGY) <= bee.workMax * 2 &&
          this.cell.controller.ticksToDowngrade > CREEP_LIFE_TIME) || // failsafe for link network
        bee.store.getUsedCapacity(RESOURCE_ENERGY) === 0
      ) {
        // let pos = target.pos.getOpenPositions(false).filter(p => p.getRangeTo(this.cell) <= 3)[0] || target;
        if (suckerTarget) bee.withdraw(suckerTarget, RESOURCE_ENERGY);
        bee.state = beeStates.work;
      }
      switch (bee.state) {
        case beeStates.fflush: {
          this.recycleBee(bee, this.hive.opt);
          break;
        }
        case beeStates.chill:
          if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            bee.goRest(this.cell.pos, this.hive.opt);
            break;
          }
          if (old) {
            // old so to keep resources transfer to storage
            if (
              bee.transfer(
                this.cell.link || this.cell.sCell.storage,
                RESOURCE_ENERGY
              ) === ERR_FULL &&
              bee.boosted
            )
              bee.drop(RESOURCE_ENERGY);
            break;
          }
        // fall through
        case beeStates.work:
          if (
            bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) &&
            bee.upgradeController(this.cell.controller) === OK &&
            Apiary.logger
          )
            Apiary.logger.addResourceStat(
              this.roomName,
              "upgrade",
              -Math.min(
                bee.getActiveBodyParts(WORK),
                this.cell.maxPossibleRate
              ),
              RESOURCE_ENERGY
            );
          break;
      }
      this.checkFlee(bee, this.hive);
    });
  }
}
