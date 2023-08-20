// new fancy war ai master
// so i can check instanceof SwarmMaster aka my army

import { Master } from "./_Master";

import { prefix } from "../enums";

import type { Bee } from "../bees/bee";
import type { FlagOrder } from "../order";
import { profile } from "../profiler/decorator";

@profile
export abstract class SwarmMaster extends Master {
  readonly order: FlagOrder;
  maxSpawns: number = 1;

  constructor(order: FlagOrder) {
    super(order.hive, prefix.swarm + order.ref);
    this.order = order;

    if (this.order.flag.memory.info) this.spawned = this.order.flag.memory.info;
  }

  checkBees(spawnExtreme?: boolean, spawnCycle?: number) {
    return this.checkBeesSwarm() && super.checkBees(spawnExtreme, spawnCycle);
  }

  checkBeesSwarm() {
    if (
      this.spawned >= this.maxSpawns &&
      !this.waitingForBees &&
      !this.beesAmount
    )
      this.order.delete();
    return this.spawned < this.maxSpawns;
  }

  newBee(bee: Bee) {
    super.newBee(bee);
    if (bee.creep.memory.born + 1 === Game.time) ++this.spawned;
    this.order.flag.memory.info = this.spawned;
  }

  set spawned(value) {
    this.order.flag.memory.info = value;
  }

  get spawned() {
    if (this.order.flag.memory.info === undefined)
      this.order.flag.memory.info = 0;
    return this.order.flag.memory.info;
  }

  get pos() {
    return this.order.pos;
  }

  get print() {
    /* let firstBee = this.bees[Object.keys(this.bees)[0]];
    let roomName = this.pos.roomName;
    if (firstBee && firstBee.pos)
      roomName = firstBee.pos.roomName; */
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.ref}"]</a>`;
  }
}
