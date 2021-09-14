// new fancy war ai master
// so i can check instanceof SwarmMaster aka my army

import { Bee } from "../bees/bee";
import { Master } from "./_Master";

import { Order } from "../order";
import { profile } from "../profiler/decorator";

@profile
export abstract class SwarmMaster extends Master {

  order: Order;
  spawned: number = 0;
  maxSpawns: number = 1;
  notify = false;

  constructor(order: Order) {
    super(order.hive, "Swarm_" + order.ref);
    this.order = order;

    if (this.order.flag.memory.info)
      this.spawned = this.order.flag.memory.info;
  }

  checkBees(spawnCycle?: number) {
    return this.checkBeesSwarm() && super.checkBees(spawnCycle);
  }

  checkBeesSwarm() {
    if (this.spawned >= this.maxSpawns && !this.waitingForBees && !this.beesAmount)
      this.order.delete();
    return this.spawned < this.maxSpawns;
  }

  newBee(bee: Bee) {
    super.newBee(bee);
    if (bee.creep.memory.born + 1 === Game.time) {
      this.spawned += 1;
      this.order.flag.memory.info = this.spawned;
    }
  }
}
