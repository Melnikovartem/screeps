import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";
import { DepositMinerMaster } from "./miners";
import { DepositPickupMaster } from "./pickup";

import { profile } from "../../profiler/decorator";
import type { FlagOrder } from "../../order";

//first tandem btw
@profile
export class DepositMaster extends SwarmMaster {
  target: Deposit | undefined;
  maxSpawns = Infinity;

  miners: DepositMinerMaster;
  // puller: DepositPullerMaster;
  pickup: DepositPickupMaster;
  positions: { pos: RoomPosition }[];
  operational: boolean = true;
  rate: number = 0;
  rest: RoomPosition;
  workAmount: number;

  constructor(order: FlagOrder) {
    super(order);
    this.order.memory.extraInfo = 0;
    this.positions = this.pos.getOpenPositions(true).map(p => { return { pos: p } });
    this.miners = new DepositMinerMaster(this);
    // this.puller = new DepositPullerMaster(this);
    this.pickup = new DepositPickupMaster(this);
    this.rest = new RoomPosition(25, 25, this.pos.roomName).findClosest(this.pos.getOpenPositions(true, 2).filter(p => p.getRangeTo(this) > 1))!;
    this.workAmount = setups.miner.deposit.getBody(this.hive.room.energyCapacityAvailable).body.filter(b => b === WORK).length;
    if (this.hive.puller)
      this.hive.puller.depositSites.push(this);
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

    if (this.pos.roomName in Game.rooms) {
      this.target = this.pos.lookFor(LOOK_DEPOSITS)[0];
      if (!this.roadTime)
        this.order.memory.extraInfo = this.pos.getTimeForPath(this.hive);
      if (this.target) {
        this.operational = (this.target.lastCooldown <= CREEP_LIFE_TIME / 7.5 || this.target.ticksToDecay < CREEP_LIFE_TIME);
        this.rate = this.miners.activeBees.length * this.positions.length / Math.max(30, this.target.lastCooldown);
      }
      if (!this.operational && (!this.pickup.beesAmount || !this.miners.beesAmount))
        this.order.delete();
      if (this.operational)
        this.hive.cells.defense.checkAndDefend(this.pos.roomName);
    } else if (this.checkBees())
      this.wish({
        setup: setups.puppet,
        priority: 2,
      });
  }

  run() {
    _.forEach(this.activeBees, bee => {
      if (this.pos.roomName in Game.rooms && !bee.pos.getEnteranceToRoom())
        return;
      bee.goTo(this.pos);
      this.checkFlee(bee, this.pos);
    });
  }

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
