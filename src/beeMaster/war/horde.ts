import { Setups } from "../../creepSetups";

import { spawnOrder } from "../../Hive";
import type { Hive } from "../../Hive";
import type { Bee } from "../../Bee";
import { SwarmMaster } from "../_SwarmMaster";

// most basic of bitches a horde full of wasps
export class haulerMaster extends SwarmMaster {
  knights: Bee[] = [];

  targetBeeCount: number;
  waitingForABee: number = 0;

  targetMap: { [id: string]: string | null } = {};

  constructor(hive: Hive, order: Flag) {
    super(hive, order);

    this.targetBeeCount = 2;
  }

  newBee(bee: Bee): void {
    this.knights.push(bee);
    if (this.waitingForABee)
      this.waitingForABee -= 1;
  }

  update() {
    this.knights = this.clearBees(this.knights);

    _.forEach(this.targetMap, (ref, key) => {
      if (ref && key && !global.bees[ref])
        this.targetMap[key] = null;
    });

    if (this.knights.length < this.targetBeeCount && !this.waitingForABee) {
      let order: spawnOrder = {
        master: this.ref,
        setup: Setups.knight,
        amount: this.targetBeeCount - this.knights.length,
        priority: 1, // 5 for not important army
      };

      if (this.targetBeeCount - this.knights.length == 1 && this.targetBeeCount > 1)
        order.priority = 5;

      this.waitingForABee += this.targetBeeCount - this.knights.length;

      this.hive.wish(order);
    }
  }

  run() {
    _.forEach(this.knights, (bee) => {
      if (bee.creep.room.name != this.order.pos.roomName) {
        bee.goTo(this.order.pos);
      } else {

      }
    });
  }
}
