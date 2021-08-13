import { Setups } from "../../creepSetups"
import type { SpawnOrder, Hive } from "../../Hive";
import { Order } from "../../order";
import { Master } from "../_Master";
import { profile } from "../../profiler/decorator";

@profile
export class puppetMaster extends Master {
  target: RoomPosition;
  maxSpawns: number = 500;
  spawned: number = 0;
  order?: Order;

  constructor(hive: Hive, annexName: string, order?: Order) {
    super(hive, "Puppet_" + annexName);

    this.order = order;
    this.target = new RoomPosition(25, 25, annexName);
  }

  update() {
    super.update();

    if (this.beesAmount == 0 && this.spawned == this.maxSpawns && this.order)
      this.order.destroyTime = Game.time;

    if (this.checkBees() && !(this.target.roomName in Game.rooms) && this.spawned < this.maxSpawns) {
      let order: SpawnOrder = {
        master: this.ref,
        setup: Setups.puppet,
        amount: 1,
        priority: 1, // well it is cheap -_-
      };

      this.wish(order);

      this.spawned += 1;
    }
  }

  run() {
    if (Game.rooms[this.target.roomName]) {
      // for now will recreate everything
      global.Apiary.destroyTime = Game.time + 10;
    }
    _.forEach(this.bees, (bee) => {
      if (bee.pos.getRangeTo(this.target) > 10)
        bee.goTo(this.target);
    });
  }
}
