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
    if (this.cell.link || (this.hive.cells.storage && this.cell.controller.pos.getRangeTo(this.hive.cells.storage.storage) < 4))
      this.fastMode = true;
  }

  update() {
    super.update();

    if (this.targetBeeCount > 1 && this.hive.cells.storage && this.hive.cells.storage.storage.store[RESOURCE_ENERGY] < 100000)
      this.targetBeeCount = 1;

    if (this.checkBees()) {
      let order: SpawnOrder = {
        master: this.ref,
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
      let ans;

      if ((this.fastMode && bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 25)
        || bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
        let suckerTarget;

        if (this.cell.link)
          suckerTarget = this.cell.link;

        if (!suckerTarget) {
          let storage = this.hive.cells.storage && this.hive.cells.storage.storage;
          if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 10000)
            suckerTarget = storage;
        }

        if (suckerTarget) {
          ans = bee.withdraw(suckerTarget, RESOURCE_ENERGY);
        } else
          bee.goRest(this.cell.pos);
      }

      if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 || ans == OK)
        bee.upgradeController(this.cell.controller);
    });
  }
}
