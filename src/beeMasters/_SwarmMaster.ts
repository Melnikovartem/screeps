// new fancy war ai master
// so i can check instanceof SwarmMaster aka my army

import type { Bee } from "../bees/bee";
import type { FlagOrder } from "../orders/order";
import { profile } from "../profiler/decorator";
import { prefix } from "../static/enums";
import { Master } from "./_Master";

@profile
export abstract class SwarmMaster extends Master {
  public readonly order: FlagOrder;
  private _maxSpawns: number = 1;

  public constructor(order: FlagOrder) {
    super(order.hive, prefix.swarm + order.ref);
    this.order = order;

    if (this.order.flag.memory.info) this.spawned = this.order.flag.memory.info;
  }

  public get maxSpawns() {
    return this._maxSpawns;
  }

  public set maxSpawns(value) {
    this._maxSpawns = value;
  }

  public checkBees(spawnExtreme?: boolean, spawnCycle?: number) {
    return this.checkBeesSwarm() && super.checkBees(spawnExtreme, spawnCycle);
  }

  public checkBeesSwarm() {
    if (
      this.spawned >= this.maxSpawns &&
      !this.waitingForBees &&
      !this.beesAmount
    )
      this.order.delete();
    return this.spawned < this.maxSpawns;
  }

  public newBee(bee: Bee) {
    super.newBee(bee);
    if (bee.creep.memory.born + 1 === Game.time) ++this.spawned;
    this.order.flag.memory.info = this.spawned;
  }

  public set spawned(value) {
    this.order.flag.memory.info = value;
  }

  public get spawned() {
    if (this.order.flag.memory.info === undefined)
      this.order.flag.memory.info = 0;
    return this.order.flag.memory.info;
  }

  public get pos() {
    return this.order.pos;
  }

  public get print() {
    /* let firstBee = this.bees[Object.keys(this.bees)[0]];
    let roomName = this.pos.roomName;
    if (firstBee && firstBee.pos)
      roomName = firstBee.pos.roomName; */
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.ref}"]</a>`;
  }
}
