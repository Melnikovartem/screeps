import { upgradeCell } from "../../cells/upgradeCell";

import { Setups } from "../../creepSetups";
import { SpawnOrder } from "../../Hive";
import { Master } from "../_Master";

export class upgraderMaster extends Master {
  cell: upgradeCell;

  constructor(upgradeCell: upgradeCell) {
    super(upgradeCell.hive, "master_" + upgradeCell.ref);

    this.cell = upgradeCell;
  }

  update() {
    super.update();

    if (this.hive.cells.storageCell) {
      // burn some energy on controller
      if (this.hive.cells.storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 150000)
        this.targetBeeCount = 2;
      else if (this.hive.cells.storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 900000)
        this.targetBeeCount = 3;
    } else
      this.targetBeeCount = 1;

    if (this.checkBees()) {
      let order: SpawnOrder = {
        master: this.ref,
        setup: Setups.upgrader.manual,
        amount: Math.max(1, this.targetBeeCount - this.beesAmount),
        priority: 4,
      };

      if (this.cell.link || (this.hive.cells.storageCell
        && this.cell.controller.pos.getRangeTo(this.hive.cells.storageCell.storage) < 5)) {
        order.setup = Setups.upgrader.fast;
        if (this.hive.cells.storageCell && this.hive.cells.storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 50000)
          order.setup.bodySetup.patternLimit = 0; // save energy from burning
      }

      this.wish(order);
    }
  }

  run() {
    _.forEach(this.bees, (bee) => {
      let ans;
      if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
        let suckerTarget;

        if (this.cell.link)
          suckerTarget = this.cell.link;

        if (!suckerTarget && this.hive.cells.storageCell
          && this.hive.cells.storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 10000)
          suckerTarget = this.hive.cells.storageCell.storage;

        if (suckerTarget) {
          if (bee.withdraw(suckerTarget, RESOURCE_ENERGY) == OK)
            ans = bee.upgradeController(this.cell.controller);
        } else
          bee.goRest(this.hive.idlePos);
      }
      if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 || ans == OK)
        bee.upgradeController(this.cell.controller);
    });
  }
}
