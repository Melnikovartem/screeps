import { setups } from "bees/creepSetups";
import { DEPOSIT_COMMODITIES } from "cells/stage1/factoryCell";
import type { SwarmOrder } from "orders/swarmOrder";
import { profile } from "profiler/decorator";

import { SwarmMaster } from "../_SwarmMaster";
import { DepositMinerMaster } from "./mineDep";
import { DepositPickupMaster } from "./pickupDep";

interface DepositInfo {
  // #region Properties (4)

  /** decay */
  dc: number;
  /** last cooldown */
  lc: number;
  /** resource */
  re: number;
  /** roadTime */
  rt: number;

  // #endregion Properties (4)
}

const MAX_DEPOSIT_COOLDOWN = CREEP_LIFE_TIME / 7.5; // 200

// this is just disfucntional master with no bees to spawn. So sad
// holds 2 different masters
@profile
export class DepositMaster extends SwarmMaster<DepositInfo> {
  // #region Properties (7)

  public miners: DepositMinerMaster;
  // implementation block
  public movePriority = 5 as const;
  public pickup: DepositPickupMaster;
  public positions: { pos: RoomPosition }[];
  public rate: number = 0;
  public target: Deposit | undefined;
  public workAmount: number;

  // #endregion Properties (7)

  // #region Constructors (1)

  // constructor
  public constructor(order: SwarmOrder<DepositInfo>) {
    super(order);
    this.sitesAll.push(this);
    // just calc this once (format for obstacles in opt traveler)
    this.positions = _.map(this.pos.getOpenPositions(), (p) => {
      return { pos: p };
    });

    // how much can we mine
    this.workAmount =
      setups.miner.deposit
        .getBody(this.hive.room.energyCapacityAvailable)
        .body.filter((b) => b === WORK).length * HARVEST_DEPOSIT_POWER;
    this.updateTarget();

    // sub masters for mining and hauling
    this.miners = new DepositMinerMaster(this);
    this.pickup = new DepositPickupMaster(this);
  }

  // #endregion Constructors (1)

  // #region Public Accessors (8)

  public get decay() {
    return this.info.dc;
  }

  public get keepMining() {
    return (
      this.lastCooldown <= MAX_DEPOSIT_COOLDOWN && this.decay > CREEP_LIFE_TIME
    );
  }

  public get lastCooldown() {
    return this.info.lc;
  }

  public get maxSpawns() {
    // so that it doesn't get deleted
    return 1;
  }

  public get resource(): DepositConstant | undefined {
    return DEPOSIT_COMMODITIES[this.info.re] || this.target?.depositType;
  }

  public get roadTime() {
    return this.info.rt;
  }

  public get shouldSpawn() {
    // decision gods said no!
    if (!this.sitesOn.includes(this)) return false;
    return this.keepMining;
  }

  public get targetBeeCount() {
    return 0;
  }

  // #endregion Public Accessors (8)

  // #region Private Accessors (2)

  private get sitesAll() {
    // JS gods said i can push/splice this :/ and original will change
    return this.hive.cells.corridorMining?.depositSites || [];
  }

  private get sitesOn() {
    return this.hive.cells.corridorMining?.depositsOn || [];
  }

  // #endregion Private Accessors (2)

  // #region Public Methods (4)

  public defaultInfo() {
    return {
      rt: this.pos.getTimeForPath(this.hive),
      dc: Game.time,
      lc: 1,
      re: -1,
    };
  }

  public override delete() {
    super.delete();
    this.miners.delete();
    this.pickup.delete();
    const index = this.sitesAll.indexOf(this);
    if (index && index !== -1) this.sitesAll.splice(index, 1);
  }

  public run() {}

  public override update() {
    super.update();

    if (this.hive.phase < 1) {
      // kinda overkill but yeah
      this.parent.delete();
      return;
    }
    this.updateTarget();

    this.rate =
      (this.workAmount * this.positions.length) /
      Math.max(30, this.lastCooldown);

    if (
      !this.keepMining &&
      (!this.pickup.beesAmount || !this.miners.beesAmount)
    )
      this.parent.delete();
    if (this.shouldSpawn)
      this.hive.cells.defense.checkAndDefend(this.pos.roomName);
  }

  // #endregion Public Methods (4)

  // #region Private Methods (1)

  private updateTarget() {
    if (!(this.pos.roomName in Game.rooms)) {
      this.target = undefined;
      if (this.decay <= 0 && this.hive.cells.observe)
        Apiary.oracle.requestSight(this.pos.roomName);
      return;
    }
    this.target = this.pos.lookFor(LOOK_DEPOSITS)[0];
    if (this.target) {
      this.info.re = DEPOSIT_COMMODITIES.indexOf(this.target.depositType);
      this.info.lc = this.target.lastCooldown;
      this.info.dc = this.target.ticksToDecay;
    } else this.info.dc = -Game.time;
  }

  // #endregion Private Methods (1)
}
