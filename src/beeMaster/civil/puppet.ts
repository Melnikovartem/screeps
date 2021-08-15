import { Bee } from "../../bee";
import { Setups } from "../../creepSetups"
import type { SpawnOrder, Hive } from "../../Hive";
import { Order } from "../../order";
import { Master } from "../_Master";
import { profile } from "../../profiler/decorator";

@profile
export class puppetMaster extends Master {
  target: RoomPosition;
  maxSpawns: number = 1;
  spawned: number = 0;
  force: boolean = false;
  order?: Order;

  constructor(hive: Hive, roomName: string, order?: Order) {
    super(hive, "Puppet_" + roomName);

    this.order = order;
    if (order)
      this.target = order.pos;
    else
      this.target = new RoomPosition(25, 25, roomName);
  }

  newBee(bee: Bee) {
    super.newBee(bee);
    bee.creep.notifyWhenAttacked(false);
    if (this.order)
      this.order.destroyTime = bee.creep.memory.born + CREEP_LIFE_TIME + 3 * bee.creep.body.length;
  }

  update() {
    super.update();


    if (this.order)
      this.target = this.order.pos;

    if (this.beesAmount == 0 && !this.waitingForBees && this.spawned == this.maxSpawns && this.order)
      this.order.destroyTime = Game.time;

    if (this.checkBees() && this.spawned < this.maxSpawns && (!(this.target.roomName in Game.rooms) || this.force)) {
      let order: SpawnOrder = {
        master: this.ref,
        setup: Setups.puppet,
        amount: 1,
        priority: 2, // well it is cheap -_-
      };

      this.wish(order);

      this.spawned += 1;
    }
  }

  run() {
    _.forEach(this.bees, (bee) => {
      Apiary.intel.getInfo(bee.pos.roomName, 50); // get intel for stuff
      bee.goRest(this.target);
    });
  }
}
