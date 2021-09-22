// new fancy war ai master
// so i can check instanceof SwarmMaster aka my army

import { Master } from "./_Master";

import type { Bee } from "../bees/bee";
import type{ Order } from "../order";
import { profile } from "../profiler/decorator";

@profile
export abstract class SwarmMaster extends Master {

  order: Order;
  spawned: number = 0;
  maxSpawns: number = 1;

  constructor(order: Order) {
    super(order.hive, "Swarm_" + order.ref);
    this.order = order;

    if (this.order.flag.memory.info)
      this.spawned = this.order.flag.memory.info;
    this.boostMove = this.boost;
  }

  checkBees(onlySafeState: boolean = false, spawnCycle?: number) {
    return this.checkBeesSwarm() && super.checkBees(onlySafeState, spawnCycle);
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
