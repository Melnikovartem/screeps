import { Setups } from "../creepSetups";

import { Hive, spawnOrder } from "../Hive";
import { Bee } from "../Bee";
import { Master } from "./_Master";

export class builderMaster extends Master {
  builders: Bee[] = [];
  targetBeeCount: number = 1;
  waitingForABee: number = 0;

  constructor(hive: Hive) {
    super(hive, "master_" + "builderHive_" + hive.room.name);
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
    if ((this.hive.emergencyRepairs.length || this.hive.constructionSites.length) && this.builders.length < this.targetBeeCount && !this.waitingForABee) {
      let order: spawnOrder = {
        master: this.ref,
        setup: Setups.builder,
        amount: this.targetBeeCount - this.builders.length,
      };

      this.waitingForABee += this.targetBeeCount - this.builders.length;

      this.hive.wish(order);
    }
  };

  run() {
    _.forEach(this.builders, (bee) => {
      // TODO: getting energy if no targets?
      let ans: number = ERR_FULL;
      if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
        let target;

        if (!target && this.hive.cells.storageCell)
          target = this.hive.cells.storageCell.storage;

        if (target)
          ans = bee.withdraw(target, RESOURCE_ENERGY);
      }

      if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 || ans == OK) {
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
