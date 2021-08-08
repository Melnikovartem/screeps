import { upgradeCell } from "../cells/upgradeCell";

import { Setups } from "../creepSetups";

import { spawnOrder } from "../Hive";
import { Bee } from "../Bee";
import { Master } from "./_Master";

export class upgraderMaster extends Master {
  upgraders: Bee[] = [];
  cell: upgradeCell;

  targetBeeCount: number = 2;
  waitingForABee: number = 0;

  constructor(upgradeCell: upgradeCell) {
    super(upgradeCell.hive, "master_" + upgradeCell.ref);

    this.cell = upgradeCell;
  }

  newBee(bee: Bee): void {
    this.upgraders.push(bee);
    if (this.waitingForABee)
      this.waitingForABee -= 1;
  }

  update() {
    this.upgraders = this.clearBees(this.upgraders);

    if (this.upgraders.length < this.targetBeeCount && !this.waitingForABee) {
      let order: spawnOrder = {
        master: this.ref,
        setup: Setups.upgrader,
        amount: this.targetBeeCount - this.upgraders.length,
        priority: 4,
      };

      this.waitingForABee += this.targetBeeCount - this.upgraders.length;

      this.hive.wish(order);
    }
  };

  run() {
    _.forEach(this.upgraders, (bee) => {
      if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
        let suckerTarget;

        if (this.cell.link)
          suckerTarget = this.cell.link;

        if (!suckerTarget && this.hive.cells.storageCell)
          suckerTarget = this.hive.cells.storageCell.storage;

        if (suckerTarget)
          if (bee.withdraw(suckerTarget, RESOURCE_ENERGY) == OK)
            bee.upgradeController(this.cell.controller);
      } else
        bee.upgradeController(this.cell.controller);
    });
  };
}
