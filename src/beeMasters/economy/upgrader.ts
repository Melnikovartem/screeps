import { upgradeCell } from "../../cells/stage1/upgradeCell";

import { Setups } from "../../creepSetups";
import { SpawnOrder } from "../../Hive";
import { Master, states } from "../_Master";
import { profile } from "../../profiler/decorator";

@profile
export class upgraderMaster extends Master {
  cell: upgradeCell;
  fastMode: boolean = false;

  constructor(upgradeCell: upgradeCell) {
    super(upgradeCell.hive, upgradeCell.ref);

    this.cell = upgradeCell;
    let storageCell = this.hive.cells.storage;
    let ratePerCreep = 1;
    let desiredRate = 0;

    if (storageCell)
      if (this.cell.link && storageCell.link) {
        let patternLimit = Math.min(Math.floor((this.hive.room.energyCapacityAvailable - 50) / 550), 8);
        this.fastMode = true;
        desiredRate = 800 / this.cell.link.pos.getRangeTo(storageCell.link); // how to get more in?
        ratePerCreep = 50 / (10 / patternLimit + Math.max(this.cell.link.pos.getTimeForPath(this.cell.controller) - 3, 0) * 2);
      } else if (storageCell && this.cell.controller.pos.getRangeTo(storageCell.storage) < 4) {
        let patternLimit = Math.min(Math.floor((this.hive.room.energyCapacityAvailable - 50) / 550 * 5), 8);
        this.fastMode = true;
        desiredRate = Math.min(storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) / 2500, 100);
        ratePerCreep = Math.floor((this.hive.room.energyCapacityAvailable - 50) / 2.2);
        ratePerCreep = 50 / ((10 / patternLimit + Math.max(storageCell.storage.pos.getTimeForPath(this.cell.controller) - 3, 0) * 2));
      } else if (storageCell) {
        let maxCap = Math.min(Math.floor(this.hive.room.energyCapacityAvailable / 4), 800);
        desiredRate = Math.min(storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) / 5000, 100);
        ratePerCreep = maxCap / (Math.max(storageCell.storage.pos.getTimeForPath(this.cell.controller) - 3, 0) * 2 + 50);
      }

    if (storageCell && storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 900000)
      this.targetBeeCount = Math.ceil(desiredRate / ratePerCreep);
    else if (storageCell && storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 200000)
      this.targetBeeCount = Math.round(desiredRate / ratePerCreep);
  }

  update() {
    super.update();

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

      this.wish(order);
    }
  }

  run() {
    _.forEach(this.bees, (bee) => {
      if (this.fastMode && bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 25 || bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0)
        bee.state = states.refill;
      else
        bee.state = states.work;

      if (bee.state == states.refill) {
        let suckerTarget;

        if (this.cell.link)
          suckerTarget = this.cell.link;

        if (!suckerTarget) {
          let storage = this.hive.cells.storage && this.hive.cells.storage.storage;
          if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 10000)
            suckerTarget = storage;
        }

        if (bee.withdraw(suckerTarget, RESOURCE_ENERGY) == OK) {
          if (Apiary.logger && suckerTarget)
            Apiary.logger.resourceTransfer(this.hive.roomName, "upgrade", suckerTarget.store, bee.store);
          bee.state = states.work;
        }

        if (!suckerTarget)
          bee.state = states.chill;
      }

      if (bee.state == states.work)
        bee.upgradeController(this.cell.controller);

      if (bee.state == states.chill)
        bee.goRest(this.cell.pos);
    });
  }
}
