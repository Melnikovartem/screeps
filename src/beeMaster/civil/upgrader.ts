import { upgradeCell } from "../../cells/stage1/upgradeCell";

import { Setups } from "../../creepSetups";
import { SpawnOrder } from "../../Hive";
import { Master } from "../_Master";
import { profile } from "../../profiler/decorator";

@profile
export class upgraderMaster extends Master {
  cell: upgradeCell;
  fastMode: boolean = false;

  constructor(upgradeCell: upgradeCell) {
    super(upgradeCell.hive, upgradeCell.ref);

    this.cell = upgradeCell;
    if (this.cell.link
      || (this.hive.cells.storageCell && this.cell.controller.pos.getRangeTo(this.hive.cells.storageCell.storage) < 4))
      this.fastMode = true;
  }

  update() {
    super.update();

    this.targetBeeCount = 1;
    if (this.hive.cells.storageCell) {
      if (this.hive.cells.storageCell.storage.store[RESOURCE_ENERGY] > 500000)
        this.targetBeeCount = 2;
    }

    if (this.checkBees()) {
      let order: SpawnOrder = {
        master: this.ref,
        setup: Setups.upgrader.manual,
        amount: Math.max(1, this.targetBeeCount - this.beesAmount),
        priority: 7,
      };

      if (this.fastMode)
        order.setup = Setups.upgrader.fast;

      this.wish(order);
    }
  }

  run() {
    _.forEach(this.bees, (bee) => {
      let ans;
      if ((this.fastMode && bee.creep.store.getFreeCapacity(RESOURCE_ENERGY) > 25)
        || bee.creep.store.getFreeCapacity(RESOURCE_ENERGY) == 0) {
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
          bee.goRest(this.cell.pos);
      }

      if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 || ans == OK)
        bee.upgradeController(this.cell.controller);
    });
  }
}
