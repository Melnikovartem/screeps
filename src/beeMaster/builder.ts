import { Setups } from "../creepSetups";

import { Hive, spawnOrder } from "../Hive";
import { Bee } from "../Bee";
import { Master } from "./_Master";

export class builderMaster extends Master {
  builders: Bee[] = [];
  targetBeeCount: number = 1;
  waitingForABee: number = 0;

  constructor(hive: Hive) {
    super(hive, "");
  }

  newBee(bee: Bee): void {
    this.builders.push(bee);
    this.waitingForABee -= 1;
  }

  /*
    checkForNewBees(): void {
      if (this.builders.length < this.bees.length) {
        _.forEach(this.bees, (bee) => {
          if (!this.builders.includes(bee)) {
            this.newBee(bee);
          }
        });
      }
    }
  */

  update() {
    if ((this.hive.emergencyRepairs || this.hive.constructionSites) && this.builders.length < this.targetBeeCount && !this.waitingForABee) {
      let order: spawnOrder = {
        master: this.ref,
        setup: Setups.builder,
        amount: this.builders.length - this.targetBeeCount,
      };

      this.waitingForABee += this.builders.length - this.targetBeeCount;

      this.hive.wish(order);
    }
  };

  run() {
    _.forEach(this.builders, (bee) => {
      // TODO: getting energy if no targets?
      if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
        let target;

        if (!target && this.hive.cells.storageCell)
          target = this.hive.cells.storageCell.storage;

        if (target)
          bee.withdraw(target, RESOURCE_ENERGY);
      } else {
        let target: RoomObject | null = bee.creep.pos.findClosest(this.hive.emergencyRepairs);
        if (!target)
          target = bee.creep.pos.findClosest(this.hive.constructionSites);
        if (!target)
          target = bee.creep.pos.findClosest(this.hive.normalRepairs);

        if (target) {
          if (target instanceof ConstructionSite)
            bee.build(target);
          else if (target instanceof Structure)
            bee.repair(target);
        }
      }
    });
  };
}
