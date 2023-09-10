import { setups } from "bees/creepSetups";
import { HIVE_ENERGY } from "cells/management/storageCell";
import type { UpgradeCell } from "cells/management/upgradeCell";
import type { BoostRequest } from "cells/stage1/laboratoryCell";
import { profile } from "profiler/decorator";
import { beeStates } from "static/enums";

import type { MovePriority } from "../_Master";
import { Master } from "../_Master";

/** on resState */
const UPGRADING_SCALE = {
  stop: 0,
  max: HIVE_ENERGY,
  after8: HIVE_ENERGY,
  /** for container/storage/terminal */
  saveStore: 1000, // save last n
  /** for spawn */
  saveSpawn: 250, // save last n
};
@profile
export class UpgraderMaster extends Master<UpgradeCell> {
  // #region Properties (2)

  private patternPerBee = 0;

  public override movePriority: MovePriority = 5;

  // #endregion Properties (2)

  // #region Public Accessors (2)

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

  public get targetBeeCount() {
    const upgradeMode = this.hive.mode.upgrade; // polen

    let desiredRate = 0;
    if (
      this.parent.controller.level < 7 &&
      this.hive.resState[RESOURCE_ENERGY] > 0 &&
      this.hive.room.terminal
    )
      desiredRate = this.parent.maxRate.import; // can always buy / ask for more
    else if (this.hive.controller.level < 4) {
      if (
        (this.hive.storage?.store.getUsedCapacity(RESOURCE_ENERGY) || 0) >
          UPGRADING_SCALE.saveStore ||
        this.hive.controller.level < 2
      )
        // early game consume as much as you can
        desiredRate = this.parent.maxRate.local;
    } else if (this.parent.controller.level < 7) {
      // mid game produced energy on upgrading when have enough to build
      const storeAmount = this.hive.resState[RESOURCE_ENERGY];
      const coef =
        (storeAmount - UPGRADING_SCALE.stop) /
        (UPGRADING_SCALE.max - UPGRADING_SCALE.stop);
      // -> math out of my ass to not consume all energy
      desiredRate = Math.max(Math.ceil(this.parent.maxRate.local * coef), 0);
    } else if (
      upgradeMode === 2 &&
      this.hive.resState.energy > UPGRADING_SCALE.after8
    )
      // upgrade spend all produced energy on upgrading
      desiredRate = this.parent.maxRate.local;
    else if (
      upgradeMode === 3 &&
      this.hive.resState.energy > UPGRADING_SCALE.after8
    )
      // boost upgrade for GCL
      desiredRate = this.parent.maxRate.import;

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
    let beeCount = Math.min(Math.ceil(targetPrecise), this.parent.maxBees);
    this.patternPerBee = Math.round(
      (targetPrecise / beeCount) * this.parent.workPerCreepMax
    );
    if (this.hive.cells.dev && this.parent.controller.ticksToDowngrade > 1000)
      beeCount = Math.min(beeCount, this.hive.cells.dev.maxUpgraderBeeCount);
    return beeCount;
  }

  // #endregion Public Accessors (2)

  // #region Public Methods (2)

  public run() {
    let suckerTarget = this.parent.suckerTarget;

    // do not use last of the energy
    if (
      suckerTarget &&
      this.hive.storage?.id === suckerTarget.id &&
      suckerTarget.structureType !== STRUCTURE_SPAWN &&
      (suckerTarget.store.getUsedCapacity(RESOURCE_ENERGY) || 0) <=
        UPGRADING_SCALE.saveStore // do not drain main storage
    )
      suckerTarget = undefined;
    else if (
      suckerTarget?.structureType === STRUCTURE_SPAWN &&
      this.hive.room.energyAvailable <= UPGRADING_SCALE.saveSpawn
    )
      suckerTarget = undefined;

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
        (this.parent.fastModePossible &&
          bee.store.getUsedCapacity(RESOURCE_ENERGY) <= bee.workMax * 2 &&
          this.parent.controller.ticksToDowngrade > CREEP_LIFE_TIME) || // failsafe for link network
        bee.store.getUsedCapacity(RESOURCE_ENERGY) === 0
      ) {
        // let pos = target.pos.getOpenPositions(true).filter(p => p.getRangeTo(this.parent) <= 3)[0] || target;
        if (suckerTarget && suckerTarget.store.getUsedCapacity(RESOURCE_ENERGY))
          bee.withdraw(suckerTarget, RESOURCE_ENERGY);
        else bee.goRest(this.pos);
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
          if (old && suckerTarget) {
            // old so to keep resources transfer to storage
            if (
              bee.transfer(suckerTarget, RESOURCE_ENERGY) === ERR_FULL &&
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
          CONTROLLER_DOWNGRADE[this.parent.controller.level] * 0.3
      )
    ) {
      let setup;
      if (this.parent.fastModePossible) {
        setup = setups.upgrader.fast.copy();
        if (this.parent.controller.level === 8 && this.hive.mode.upgrade >= 2)
          setup.fixed = [CARRY, CARRY, CARRY]; // save some cpu on withdrawing
      } else setup = setups.upgrader.manual.copy();
      setup.patternLimit = this.patternPerBee;
      this.wish({
        setup,
        priority:
          this.parent.controller.level === 8 || this.beesAmount >= 2 ? 8 : 6,
      });
    }
  }

  // #endregion Public Methods (2)
}
