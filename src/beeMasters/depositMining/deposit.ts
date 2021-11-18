import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";
import { DepositMinerMaster } from "./miners";
import { DepositPullerMaster } from "./puller";
import { DepositPickupMaster } from "./pickup";

import { profile } from "../../profiler/decorator";
import type { Order } from "../../order";

//first tandem btw
@profile
export class DepositMaster extends SwarmMaster {
  target: Deposit | undefined;
  maxSpawns = Infinity;

  miners: DepositMinerMaster;
  puller: DepositPullerMaster;
  pickup: DepositPickupMaster;
  positions: number = 0;
  operational: boolean = false;
  rate: number = 0;
  rest: RoomPosition;

  constructor(order: Order) {
    super(order);
    this.order.memory.extraInfo = 0;
    this.positions = this.pos.getOpenPositions(true).length;
    this.miners = new DepositMinerMaster(this);
    this.puller = new DepositPullerMaster(this);
    this.pickup = new DepositPickupMaster(this);
    this.rest = new RoomPosition(25, 25, this.pos.roomName).findClosest(this.pos.getOpenPositions(true, 2).filter(p => p.getRangeTo(this) > 1))!;
  }

  get roadTime() {
    return <number>this.order.memory.extraInfo;
  }

  update() {
    super.update();
    this.operational = false;
    if (!this.hive.cells.storage) {
      this.order.delete()
      return;
    }
    if (this.order.pos.roomName in Game.rooms) {
      this.target = this.order.pos.lookFor(LOOK_DEPOSITS)[0];
      if (!this.roadTime)
        this.order.memory.extraInfo = this.pos.getTimeForPath(this.hive);
      if (this.target) {
        this.operational = this.target.lastCooldown < CREEP_LIFE_TIME / 3;
        this.rate = setups.miner.deposit.getBody(this.hive.room.energyCapacityAvailable).body.filter(b => b === WORK).length
          * this.positions / Math.max(30, this.target.lastCooldown);
      }
      if (!this.operational && !this.pickup.beesAmount)
        this.order.delete();
      if (this.operational)
        this.hive.cells.defense.checkAndDefend(this.pos.roomName);
    } else
      if (this.checkBees())
        this.wish({
          setup: setups.puppet,
          priority: 2,
        });
  }

  run() {
    _.forEach(this.activeBees, bee => {
      if (this.pos.roomName in Game.rooms && !bee.pos.getEnteranceToRoom())
        return;
      bee.goTo(this.order.pos);
      this.checkFlee(bee, this.order.pos);
    });
  }

  delete() {
    super.delete();
    this.miners.delete();
    this.puller.delete();
    this.pickup.delete();
  }
}
