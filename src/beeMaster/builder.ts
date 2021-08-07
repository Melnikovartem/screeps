import { Master } from "./_Master";
import { Hive, spawnOrder } from "../Hive";
import { Bee } from "../Bee";
import { Setups } from "../creepSetups";

export class builderMaster extends Master {
  builders: Bee[] = [];
  targetBeeCount: number = 1;
  waitingForABee: number = 0;

  constructor(hive: Hive) {
    super(hive, "");
  }

  catchBee(bee: Bee): void {
    this.builders.push(bee);
    this.waitingForABee -= 1;
  }

  update() {
    if ((this.hive.emergencyRepairs || this.hive.constructionSites) && this.builders.length < this.targetBeeCount && !this.waitingForABee) {
      let order: spawnOrder = {
        master: this,
        setup: Setups.builder,
        amount: this.builders.length - this.targetBeeCount,
      };

      this.waitingForABee += this.builders.length - this.targetBeeCount;

      this.hive.wish(order);
    }
  };

  run() {
    _.forEach(this.builders, (bee) => {
      // TODO: getting energy
      let target: RoomObject | null = bee.creep.pos.findClosest(this.hive.emergencyRepairs);
      if (!target)
        target = bee.creep.pos.findClosest(this.hive.constructionSites);
      if (!target)
        target = bee.creep.pos.findClosest(this.hive.normalRepairs);

      if (target) {
        bee.goTo(target.pos);
      }
    });
  };
}
