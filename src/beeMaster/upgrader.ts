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
    super(upgradeCell.hive, upgradeCell.ref);

    this.controller = upgradeCell.controller;
    this.link = upgradeCell.link;

    this.updateCash(['controller']);
  }

  newBee(bee: Bee): void {
    this.upgraders.push(bee);
    this.waitingForABee -= 1;
  }

  update() {
    if ((this.hive.emergencyRepairs || this.hive.constructionSites) && this.upgraders.length < this.targetBeeCount && !this.waitingForABee) {
      let order: spawnOrder = {
        master: this.ref,
        setup: Setups.builder,
        amount: this.upgraders.length - this.targetBeeCount,
      };

      this.waitingForABee += this.upgraders.length - this.targetBeeCount;

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
          bee.withdraw(target, RESOURCE_ENERGY);
      } else {
        bee.upgradeController(this.controller);
      }
    });
  };
}
