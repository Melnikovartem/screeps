import { upgradeCell } from "../../cells/stage1/upgradeCell";

import { Setups } from "../../creepSetups";
import { Master, states } from "../_Master";
import type { SpawnOrder } from "../../Hive";
import { profile } from "../../profiler/decorator";

@profile
export class upgraderMaster extends Master {
  cell: upgradeCell;
  fastMode: boolean = false;
  boost = true;
  patternPerBee = Infinity;
  maxRate = 1;
  ratePerCreep = 1;

  constructor(upgradeCell: upgradeCell) {
    super(upgradeCell.hive, upgradeCell.ref);

    this.cell = upgradeCell;
    let storageCell = this.hive.cells.storage;

    if (storageCell) {
      let storageLink = storageCell.links[Object.keys(storageCell.links)[0]];
      if (this.cell.link && storageLink) {
        let patternLimit = Math.min(Math.floor((this.hive.room.energyCapacityAvailable - 50) / 550), 8);
        this.fastMode = true;
        this.maxRate = 800 / this.cell.link.pos.getRangeTo(storageLink); // how to get more in?
        this.ratePerCreep = 50 / (10 / patternLimit + Math.max(this.cell.link.pos.getTimeForPath(this.cell.controller) - 3, 0) * 2);
      } else if (storageCell && this.cell.controller.pos.getRangeTo(storageCell.storage) < 4) {
        let patternLimit = Math.min(Math.floor((this.hive.room.energyCapacityAvailable - 50) / 550), 8);
        this.fastMode = true;
        this.maxRate = Math.min(storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) / 2500, 100);
        this.ratePerCreep = Math.floor((this.hive.room.energyCapacityAvailable - 50) / 2.2);
        this.ratePerCreep = 50 / ((10 / patternLimit + Math.max(storageCell.storage.pos.getTimeForPath(this.cell.controller) * 2 - 3, 0) * 2));
      } else if (storageCell) {
        let maxCap = Math.min(Math.floor(this.hive.room.energyCapacityAvailable / 4), 800);
        this.maxRate = Math.min(storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) / 5000, 100);
        this.ratePerCreep = maxCap / (Math.max(storageCell.storage.pos.getTimeForPath(this.cell.controller) * 2 - 3, 0) * 2 + 50);
      }
    }

    this.recalculateTargetBee();
  }

  recalculateTargetBee() {
    let storageCell = this.hive.cells.storage;
    if (this.hive.stage === 2) {
      this.targetBeeCount = 1;
      this.patternPerBee = 0;
    } else if (storageCell && storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 25000) {
      this.targetBeeCount = 1;
      this.patternPerBee = 0;
    } else if (storageCell) {
      let desiredRate = this.maxRate;
      if (this.cell.link && Object.keys(storageCell.links).length > 1
        && storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 200000)
        desiredRate *= Object.keys(storageCell.links).length;
      let rounding = Math.floor;
      if (storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 900000)
        rounding = Math.ceil;
      else if (storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 200000)
        rounding = Math.round;

      this.targetBeeCount = rounding(desiredRate / this.ratePerCreep);
      this.patternPerBee = rounding(desiredRate / 5 / this.targetBeeCount);
    }
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

        if (!this.fastMode)
          if (this.cell.link || (this.hive.cells.storage && this.cell.controller.pos.getRangeTo(this.hive.cells.storage.storage) < 4))
            this.fastMode = true;

        if (this.fastMode)
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
      if ((this.fastMode && bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 25
        || bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) && bee.state !== states.boosting) {
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
      }
    });
  }
}
