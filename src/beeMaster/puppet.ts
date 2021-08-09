import { Setups } from "../creepSetups";

import { Hive, spawnOrder } from "../Hive";
import { Bee } from "../Bee";
import { Master } from "./_Master";

export class puppetMaster extends Master {
  puppets: Bee[] = [];
  target: RoomPosition; //controllers rly don't age...

  waitingForABee: number = 0;

  constructor(hive: Hive, annexName: string) {
    super(hive, "master_" + "puppetFor_" + annexName);

    this.target = new RoomPosition(25, 25, annexName);
  }

  newBee(bee: Bee): void {
    this.puppets.push(bee);
    if (this.waitingForABee)
      this.waitingForABee = 0;
  }

  update() {
    this.puppets = this.clearBees(this.puppets);

    // 5 for random shit
    if (this.puppets.length == 0 && !this.waitingForABee) {
      let order: spawnOrder = {
        master: this.ref,
        setup: Setups.puppet,
        amount: 1,
        priority: 5,
      };

      this.waitingForABee = 1;

      this.hive.wish(order);
    }
  }

  run() {
    if (Game.rooms[this.target.roomName]) {
      // for now will recreate everything
      global.Apiary.destroyTime = Game.time + 10;
    }
    _.forEach(this.puppets, (bee) => {
      if (bee.creep.pos.getRangeTo(this.target) > 10)
        bee.goTo(this.target);
    });
  }
}
