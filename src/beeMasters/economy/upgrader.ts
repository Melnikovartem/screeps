import { setups } from "bees/creepSetups";
import type { BoostRequest } from "cells/stage1/laboratoryCell";
import { HIVE_ENERGY } from "cells/stage1/storageCell";
import type { UpgradeCell } from "cells/stage1/upgradeCell";
import { profile } from "profiler/decorator";
import { beeStates } from "static/enums";

import type { MovePriority } from "../_Master";
import { Master } from "../_Master";

const UPGRADING_AFTER_8_ENERGY = HIVE_ENERGY; // double the amount to start upgrading

@profile
export class UpgraderMaster extends Master<UpgradeCell> {
  // #region Properties (2)

  private patternPerBee = 0;

  public override movePriority: MovePriority = 5;

  // #endregion Properties (2)

  // #region Public Accessors (3)

  public override get boosts(): BoostRequest[] {
    const upgradeMode = this.hive.mode.upgrade; // polen
    switch (upgradeMode) {
      case 3:
        break;
      case 2:
      case 1:
        if (this.parent.controller.level < 8) break;
      // fall through
      case 0:
        return [];
    }
    return [
      { type: "upgrade", lvl: 2 },
      { type: "upgrade", lvl: 1 },
      { type: "upgrade", lvl: 0 },
    ];
  }

  public get fastModePossible() {
    return this.suckerTarget && this.pos.getRangeTo(this.suckerTarget) <= 3;
  }

  public get targetBeeCount() {
    const upgradeMode = this.hive.mode.upgrade; // polen

    const storeAmount =
      this.hive.storage.store.getUsedCapacity(RESOURCE_ENERGY);

    let desiredRate = 0;
    if (
      this.parent.controller.level < 7 &&
      this.hive.resState[RESOURCE_ENERGY] > 0 &&
      this.hive.room.terminal
    )
      desiredRate = this.parent.maxRate; // can always buy / ask for more
    else if (this.parent.controller.level < 7)
      desiredRate = Math.min(
        this.parent.maxRate,
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
      desiredRate = this.parent.maxRate; // upgrade for GCL

    // failsafe (kidna but no)
    if (
      !desiredRate &&
      this.parent.controller.ticksToDowngrade <
        CONTROLLER_DOWNGRADE[this.parent.controller.level] * 0.5
    )
      desiredRate = 2; // enought to fix anything

    // we save smth for sure here
    if (upgradeMode === 0) desiredRate = Math.min(desiredRate, 1);

    const targetPrecise =
      Math.min(desiredRate, this.parent.maxPossibleRate) /
      this.parent.ratePerCreepMax;
    const ans = Math.min(Math.ceil(targetPrecise), this.parent.maxBees);
    this.patternPerBee = Math.round(
      (targetPrecise / ans) * this.parent.workPerCreepMax
    );
    return ans;
  }

  // #endregion Public Accessors (3)

  // #region Protected Accessors (1)

  protected get suckerTarget() {
    if (this.parent.link && this.hive.cells.storage.link) {
      if (this.parent.link.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
        return this.parent.link;
    } else if (this.hive.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 1000)
      return this.hive.storage;
    return undefined;
  }

  // #endregion Protected Accessors (1)

  // #region Public Methods (2)

  public run() {
    const suckerTarget = this.suckerTarget;

    this.preRunBoost();

    _.forEach(this.activeBees, (bee) => {
      if (bee.state === beeStates.boosting) return;

      const carryPart = bee.getActiveBodyParts(CARRY);
      const old =
        bee.ticksToLive <=
        (bee.boosted
          ? this.parent.roadTime * 3 + 5
          : carryPart <= 3
          ? 2
          : this.parent.roadTime + 10);

      if (old) {
        // if any energy store it else go recycle yourself
        if (bee.store.getUsedCapacity(RESOURCE_ENERGY))
          bee.state = beeStates.chill; // now save energy normal way
        else bee.state = beeStates.fflush; // recycle boosts
      } else if (
        (this.fastModePossible &&
          bee.store.getUsedCapacity(RESOURCE_ENERGY) <= bee.workMax * 2 &&
          this.parent.controller.ticksToDowngrade > CREEP_LIFE_TIME) || // failsafe for link network
        bee.store.getUsedCapacity(RESOURCE_ENERGY) === 0
      ) {
        // let pos = target.pos.getOpenPositions().filter(p => p.getRangeTo(this.parent) <= 3)[0] || target;
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
            bee.goRest(this.parent.pos, this.hive.opt);
            break;
          }
          if (old) {
            // old so to keep resources transfer to storage
            if (
              bee.transfer(
                this.parent.link || this.hive.storage,
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
            bee.upgradeController(this.parent.controller) === OK &&
            Apiary.logger
          )
            Apiary.logger.addResourceStat(
              this.hiveName,
              "upgrade",
              -Math.min(
                bee.getActiveBodyParts(WORK),
                this.parent.maxPossibleRate
              ),
              RESOURCE_ENERGY
            );
          break;
      }
      this.checkFlee(bee, this.hive);
    });
  }

  public override update() {
    super.update();

    if (
      this.checkBees(
        this.parent.controller.ticksToDowngrade <
          CONTROLLER_DOWNGRADE[this.parent.controller.level] * 0.5
      )
    ) {
      let upgrader;
      if (this.fastModePossible) {
        upgrader = setups.upgrader.fast.copy();
        if (this.parent.controller.level === 8 && this.hive.mode.upgrade >= 2)
          upgrader.fixed = [CARRY, CARRY, CARRY]; // save some cpu on withdrawing
      } else upgrader = setups.upgrader.manual.copy();
      upgrader.patternLimit = this.patternPerBee;
      this.wish({
        setup: upgrader,
        priority:
          this.parent.controller.level === 8 || this.beesAmount >= 2 ? 8 : 6,
      });
    }
  }

  // #endregion Public Methods (2)
}
