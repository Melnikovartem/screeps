import { Bee } from "../../bee";
import { Setups } from "../../creepSetups"
import type { SpawnOrder } from "../../Hive";
import { Order } from "../../order";
import { Master } from "../_Master";
import { profile } from "../../profiler/decorator";

@profile
export class puppetMaster extends Master {
  target: RoomPosition;
  maxSpawns: number = 1;
  spawned: number = 0;
  order: Order;

  constructor(order: Order) {
    super(order.hive, "Puppet_" + order.ref);

    this.order = order;
    this.target = order.pos;
  }

  newBee(bee: Bee) {
    super.newBee(bee);
    bee.creep.notifyWhenAttacked(false);
    if (this.order)
      this.order.destroyTime = bee.creep.memory.born + CREEP_LIFE_TIME + 3 * bee.creep.body.length;
    this.spawned += 1;
  }

  update() {
    super.update();
    this.target = this.order.pos;

    if (this.checkBees() && this.spawned < this.maxSpawns) {
      let order: SpawnOrder = {
        setup: Setups.puppet,
        amount: 1,
        priority: 2, // well it is cheap -_-
      };

      this.wish(order);
    }

    if (this.beesAmount === 0 && !this.waitingForBees && this.spawned === this.maxSpawns)
      this.order.destroyTime = Game.time;
  }

  run() {
    _.forEach(this.bees, (bee) => {
      Apiary.intel.getInfo(bee.pos.roomName, 50); // get intel for stuff
      bee.goRest(this.order.pos);
    });
  }
}
