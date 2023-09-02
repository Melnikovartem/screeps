import { setups } from "bees/creepSetups";
import type { FlagOrder } from "orders/order";
import { SwarmOrder } from "orders/swarmOrder";
import { profile } from "profiler/decorator";

import { SwarmMaster } from "../_SwarmMaster";
import { DepositMinerMaster } from "./miners";
import { DepositPickupMaster } from "./pickup";

interface DepositInfo {
  roadTime: number;
  decay: number;
  lastCooldown: number;
}

// this is just disfucntional master with no bees to spawn. So sad
// holds 2 different masters
@profile
export class DepositMaster extends SwarmMaster<DepositInfo> {
  // constructor
  public constructor(order: SwarmOrder<DepositInfo>) {
    super(order);
    // just calc this once
    this.positions = this.pos.getOpenPositions(true);
    // sub masters for mining and hauling
    this.miners = new DepositMinerMaster(this);
    this.pickup = new DepositPickupMaster(this);

    this.workAmount = setups.miner.deposit
      .getBody(this.hive.room.energyCapacityAvailable)
      .body.filter((b) => b === WORK).length;
    if (this.hive.puller) this.hive.puller.depositSites.push(this);
    if (this.pos.roomName in Game.rooms) this.updateTarget();
  }

  // implementation block
  public movePriority = 5 as const;
  public get targetBeeCount() {
    return 0;
  }
  protected defaultInfo() {
    return {
      roadTime: this.pos.getTimeForPath(this.hive),
      decay: Game.time,
      lastCooldown: 1,
    };
  }
  public get maxSpawns() {
    // so that it doesn't get deleted
    return 1;
  }

  public target: Deposit | undefined;

  public miners: DepositMinerMaster;
  public pickup: DepositPickupMaster;

  public positions: RoomPosition[];
  public operational: boolean = false;
  public rate: number = 0;
  public workAmount: number;

  public get shouldSpawn() {
    // decision gods said no!
    if (!this.corridorMining?.sitesON.includes(this)) return false;
    return this.operational;
  }

  public updateTarget() {
    this.target = this.pos.lookFor(LOOK_DEPOSITS)[0];
    if (this.target) {
      this.info.lastCooldown = this.target.lastCooldown;
      this.info.decay = this.target.ticksToDecay;
    } else this.info.decay = -Game.time;
  }

  public get resource() {
    return this.target?.depositType;
  }

  public update() {
    super.update();

    if (!this.hive.cells.storage) {
      this.order.delete();
      return;
    }
    if (this.pos.roomName in Game.rooms) this.updateTarget();
    else {
      this.target = undefined;
      if (this.info.decay <= 0 && this.hive.cells.observe)
        Apiary.requestSight(this.pos.roomName);
    }

    this.operational =
      this.info.lastCooldown <= CREEP_LIFE_TIME / 7.5 &&
      this.info.decay > CREEP_LIFE_TIME;
    this.rate =
      (this.workAmount * this.positions.length) /
      Math.max(30, this.info.lastCooldown);

    if (
      !this.operational &&
      (!this.pickup.beesAmount || !this.miners.beesAmount)
    )
      this.order.delete();
    if (this.shouldSpawn)
      this.hive.cells.defense.checkAndDefend(this.pos.roomName);
  }

  public run() {}

  public delete() {
    super.delete();
    this.miners.delete();
    this.pickup.delete();
    if (this.hive.puller) {
      const index = this.hive.puller.depositSites.indexOf(this);
      if (index !== -1) this.hive.puller.depositSites.splice(index, 1);
    }
  }
}
