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
    if (this.waitingForABee)
      this.waitingForABee -= 1;
  }

  update() {
    this.builders = this.clearBees(this.builders);

    if ((this.hive.emergencyRepairs.length || this.hive.constructionSites.length) && this.builders.length < this.targetBeeCount && !this.waitingForABee) {
      let order: spawnOrder = {
        master: this.ref,
        setup: Setups.builder,
        amount: this.targetBeeCount - this.builders.length,
        priority: 4,
      };

      this.waitingForABee += this.targetBeeCount - this.builders.length;

      this.hive.wish(order);
    }
  }

  run() {
    _.forEach(this.builders, (bee) => {
      let ans: number = ERR_FULL;
      if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
        let suckerTarget;

        if (!suckerTarget && this.hive.cells.storageCell)
          suckerTarget = this.hive.cells.storageCell.storage;

        if (suckerTarget)
          ans = bee.withdraw(suckerTarget, RESOURCE_ENERGY);
        else
          ans = OK;
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
  }
}
