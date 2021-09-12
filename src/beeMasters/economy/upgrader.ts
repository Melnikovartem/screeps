import { upgradeCell } from "../../cells/stage1/upgradeCell";

import { posPrefix } from "../../order";
import { Setups } from "../../creepSetups";
import { Master, states } from "../_Master";
import type { SpawnOrder } from "../../Hive";
import { profile } from "../../profiler/decorator";

@profile
export class upgraderMaster extends Master {
  cell: upgradeCell;
  boost = true;
  patternPerBee = 0;
  fastMode = false;
  fastModePossible = false;

  constructor(upgradeCell: upgradeCell) {
    super(upgradeCell.hive, upgradeCell.ref);
    this.cell = upgradeCell;
  }

  recalculateTargetBee() {
    let storageCell = this.hive.cells.storage;
    if (!storageCell)
      return;

    this.fastModePossible = !!(this.cell.link && Object.keys(storageCell.links).length || this.cell.pos.getRangeTo(storageCell.storage) < 4);

    this.targetBeeCount = 1;
    this.patternPerBee = 0;

    this.fastMode = true;
    if (!(posPrefix.upgrade + this.hive.roomName in Game.flags)) {
      this.fastMode = false;
      return;
    }

    if (storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 25000)
      return;

    let desiredRate = this.cell.maxRate;
    if (this.cell.link && Object.keys(storageCell.links).length > 1
      && storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 200000)
      desiredRate *= Object.keys(storageCell.links).length;
    let rounding = Math.floor;
    if (storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 900000)
      rounding = Math.ceil;
    else if (storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 400000)
      rounding = Math.round;

    this.targetBeeCount = rounding(desiredRate / this.cell.ratePerCreepMax);
    this.patternPerBee = rounding(desiredRate / 5 / this.targetBeeCount);
  }

  update() {
    super.update();

    if (this.checkBees()) {
      this.recalculateTargetBee();
      if (this.checkBees()) {
        let order: SpawnOrder = {
          setup: Setups.upgrader.manual,
          amount: Math.max(1, this.targetBeeCount - this.beesAmount),
          priority: 8,
        };

        if (this.fastModePossible)
          order.setup = Setups.upgrader.fast;

        if (this.cell.controller.ticksToDowngrade < 1500) {
          // idk how but we failed miserably
          order.priority = 2;
          order.setup = Setups.upgrader.manual;
        }

        order.setup.patternLimit = this.patternPerBee;
        this.wish(order);
      }
    }
  }

  run() {
    _.forEach(this.bees, (bee) => {
      if ((this.fastModePossible && bee.store.getUsedCapacity(RESOURCE_ENERGY) <= 25 || bee.store.getUsedCapacity(RESOURCE_ENERGY) === 0) && bee.state !== states.boosting) {
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
            bee.state = states.work;
            break;
          case ERR_NOT_FOUND:
            bee.state = states.chill;
            break;
          default:
            bee.state = states.refill;
            break;
        }
      }

      switch (bee.state) {
        case states.work:
          bee.upgradeController(this.cell.controller);
          break;
        case states.chill:
          if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
            bee.state = states.work;
          bee.goRest(this.cell.pos);
          break;
        case states.boosting:
          if (!this.hive.cells.lab || this.hive.cells.lab.askForBoost(bee, [{ type: "upgrade" }]) === OK)
            bee.state = states.chill;
          break;
        case states.refill:
          if (bee.store.getFreeCapacity(RESOURCE_ENERGY) === 0)
            bee.state = states.work;
      }
    });
  }
}
