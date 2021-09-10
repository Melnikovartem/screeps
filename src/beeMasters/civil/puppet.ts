import { Setups } from "../../creepSetups"
import { Master } from "../_Master";
import type { Bee } from "../../bee";
import type { Order } from "../../order";
import type { SpawnOrder } from "../../Hive";
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
      this.order.delete();
  }

  run() {
    _.forEach(this.bees, (bee) => {
      Apiary.intel.getInfo(bee.pos.roomName, 50); // get intel for stuff
      bee.goRest(this.order.pos);
    });
  }
}
