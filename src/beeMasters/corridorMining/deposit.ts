import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";
import { DepositMinerMaster } from "./miners";
import { DepositPickupMaster } from "./pickup";

import { profile } from "../../profiler/decorator";
import type { FlagOrder } from "../../order";
import type { PullerMaster } from "./puller";

//first tandem btw
@profile
export class DepositMaster extends SwarmMaster {
  target: Deposit | undefined;
  maxSpawns = Infinity;

  miners: DepositMinerMaster;
  // puller: DepositPullerMaster;
  pickup: DepositPickupMaster;
  positions: { pos: RoomPosition }[];
  operational: boolean = false;
  rate: number = 0;
  rest: RoomPosition;
  workAmount: number;

  parent: PullerMaster;

  constructor(order: FlagOrder, parent: PullerMaster) {
    super(order);
    this.parent = parent;
    this.positions = this.pos.getOpenPositions(true).map(p => { return { pos: p } });
    this.miners = new DepositMinerMaster(this);
    // this.puller = new DepositPullerMaster(this);
    this.pickup = new DepositPickupMaster(this);
    this.rest = new RoomPosition(25, 25, this.pos.roomName).findClosest(this.pos.getOpenPositions(true, 2).filter(p => p.getRangeTo(this) > 1))!;
    this.workAmount = setups.miner.deposit.getBody(this.hive.room.energyCapacityAvailable).body.filter(b => b === WORK).length;
    if (this.hive.puller)
      this.hive.puller.depositSites.push(this);
    if (!this.order.memory.extraInfo)
      this.order.memory.extraInfo = {
        roadTime: this.pos.getTimeForPath(this.hive),
        decay: Game.time,
        lastCooldown: 1,
      };
    if (this.pos.roomName in Game.rooms)
      this.updateTarget();
  }


  get decay() {
    return <number>this.order.memory.extraInfo.decay - Game.time;
  }

  set decay(value) {
    this.order.memory.extraInfo.decay = Game.time + value;
  }

  get lastCooldown() {
    return <number>this.order.memory.extraInfo.lastCooldown;
  }

  set lastCooldown(value) {
    this.order.memory.extraInfo.lastCooldown = value;
  }

  get roadTime() {
    return <number>this.order.memory.extraInfo.roadTime;
  }

  get shouldSpawn() {
    return this.operational && this.parent.sitesON.includes(this);
  }

  updateTarget() {
    this.target = this.pos.lookFor(LOOK_DEPOSITS)[0];
    if (this.target) {
      this.lastCooldown = this.target.lastCooldown;
      this.decay = this.target.ticksToDecay;
    } else
      this.decay = -Game.time;
  }

  update() {
    super.update();

    if (!this.hive.cells.storage) {
      this.order.delete()
      return;
    }
    if (this.pos.roomName in Game.rooms)
      this.updateTarget();
    else {
      this.target = undefined;
      if (this.decay <= 0 && this.hive.cells.observe)
        Apiary.requestSight(this.pos.roomName);
    }

    this.operational = this.lastCooldown <= CREEP_LIFE_TIME / 7.5 && this.decay > CREEP_LIFE_TIME;
    this.rate = this.workAmount * this.positions.length / Math.max(30, this.lastCooldown);

    if (!this.operational && (!this.pickup.beesAmount || !this.miners.beesAmount))
      this.order.delete();
    if (this.shouldSpawn && Game.shard.name !== "shard3")
      this.hive.cells.defense.checkAndDefend(this.pos.roomName);
  }

  run() { }

  delete() {
    super.delete();
    this.miners.delete();
    this.pickup.delete();
    if (this.hive.puller) {
      let index = this.hive.puller.depositSites.indexOf(this);
      if (index !== -1)
        this.hive.puller.depositSites.splice(index, 1);
    }
  }
}
