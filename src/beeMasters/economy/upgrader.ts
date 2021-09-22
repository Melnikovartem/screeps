import { UpgradeCell } from "../../cells/stage1/upgradeCell";
import { Master } from "../_Master";

import { beeStates } from "../../enums";
import { setups } from "../../bees/creepsetups";
import { prefix } from "../../order";
import { STORAGE_BALANCE } from "../../cells/stage1/storageCell";

import { profile } from "../../profiler/decorator";
import type { SpawnOrder } from "../../Hive";

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
    this.patternPerBee = 0;
    this.boost = false;

    this.fastMode = true;
    if (!(prefix.upgrade + this.hive.roomName in Game.flags)) {
      this.fastMode = false;
      return;
    }

    this.boost = true;

    if (storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 25000)
      return;

    let desiredRate = this.cell.maxRate;
    let rounding = Math.floor;
    if (storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) >= STORAGE_BALANCE[RESOURCE_ENERGY])
      rounding = Math.ceil;

    this.targetBeeCount = rounding(desiredRate / this.cell.ratePerCreepMax);
    this.patternPerBee = rounding(desiredRate / this.targetBeeCount);
  }

  update() {
    super.update();

    if (this.checkBees() && (this.cell.controller.ticksToDowngrade < 6000)) {
      this.recalculateTargetBee();
      if (this.checkBees()) {
        let order: SpawnOrder = {
          setup: setups.upgrader.manual,
          amount: 1,
          priority: 8,
        };

        if (this.fastModePossible)
          order.setup = setups.upgrader.fast;

        if (this.cell.controller.ticksToDowngrade < 2000) {
          order.priority = 2;
          order.setup = setups.upgrader.manual;
        }

        order.setup.patternLimit = this.patternPerBee;
        this.wish(order);
      }
    }
  }

  run() {
    if (this.boost)
      _.forEach(this.bees, (bee) => {
        if (bee.state === beeStates.boosting)
          if (!this.hive.cells.lab || this.hive.cells.lab.askForBoost(bee, [{ type: "upgrade" }]) === OK)
            bee.state = beeStates.chill;
      });

    _.forEach(this.activeBees, (bee) => {
      if (bee.state === beeStates.boosting)
        return;
      if ((this.fastModePossible && bee.store.getUsedCapacity(RESOURCE_ENERGY) <= 25 || bee.store.getUsedCapacity(RESOURCE_ENERGY) === 0)) {
        let suckerTarget;
        if (this.cell.link)
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
          bee.upgradeController(this.cell.controller)
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
