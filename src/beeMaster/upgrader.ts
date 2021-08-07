import { upgradeCell } from "../cells/upgradeCell";

import { Setups } from "../creepSetups";

import { spawnOrder } from "../Hive";
import { Bee } from "../Bee";
import { Master } from "./_Master";

export class upgraderMaster extends Master {
  upgraders: Bee[] = [];
  controller: StructureController;
  link: StructureLink | undefined;

  targetBeeCount: number = 2;
  waitingForABee: number = 0;

  constructor(upgradeCell: upgradeCell) {
    super(upgradeCell.hive, "master_" + upgradeCell.ref);

    this.controller = upgradeCell.controller;
    this.link = upgradeCell.link;

    this.updateCash(['controller']);
  }

  newBee(bee: Bee): void {
    this.upgraders.push(bee);
    if (this.waitingForABee)
      this.waitingForABee -= 1;
  }

  update() {
    if (this.upgraders.length < this.targetBeeCount && !this.waitingForABee) {
      let order: spawnOrder = {
        master: this.ref,
        setup: Setups.upgrader,
        amount: this.targetBeeCount - this.upgraders.length,
      };

      this.waitingForABee += this.targetBeeCount - this.upgraders.length;

      this.hive.wish(order);
    }
  };

  run() {
    _.forEach(this.upgraders, (bee) => {

      if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
        let target;

        if (this.link)
          target = this.link;

        if (!target && this.hive.cells.storageCell)
          target = this.hive.cells.storageCell.storage;

        if (target)
          if (bee.withdraw(target, RESOURCE_ENERGY) == OK)
            bee.upgradeController(this.controller);
      } else
        bee.upgradeController(this.controller);
    });
  };
}
