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
    if (this.cell.link || (this.hive.cells.storage && this.cell.controller.pos.getRangeTo(this.hive.cells.storage.storage) < 4))
      this.fastMode = true;

    let storageLink = this.hive.cells.storage && this.hive.cells.storage.link;
    if (this.cell.link && storageLink)
      this.targetBeeCount = Math.round(780 / this.cell.link.pos.getRangeTo(storageLink) / Math.floor(this.hive.room.energyCapacityAvailable / 550 * 5));
  }

  update() {
    super.update();

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

        if (bee.withdraw(suckerTarget, RESOURCE_ENERGY) == OK)
          bee.state = states.work;

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
