// import { makeId } from "../utils/other";
import type { Bee } from "../bees/bee";
import type { BoostRequest } from "../cells/stage1/laboratoryCell";
import type { Hive } from "../hive/hive";
import { profile } from "../profiler/decorator";
import { beeStates, prefix } from "../static/enums";
import {
  checkBees,
  deleteBee,
  newBee,
  recycleBee,
  removeBee,
  wish,
} from "./_Master-beeManage";
import { checkFlee, preRunBoost, secureBoostsHive } from "./_Master-utils";

export type Boosts = BoostRequest[];

// i will need to do something so i can build up structure from memory
@profile
export abstract class Master {
  public readonly hive: Hive;
  public readonly ref: string;

  private _targetBeeCount: number = 1;
  public waitingForBees: number = 0;
  public notify = true;

  private _oldestSpawn: number = -1;
  public beesAmount: number = 0;
  public bees: { [id: string]: Bee } = {};
  public stcukEnterance: { [id: string]: number | undefined } = {};
  public activeBees: Bee[] = [];
  private _boosts: undefined | Boosts;
  public boostTier: 0 | 1 | 2 | 3 = 0;
  public movePriority: 0 | 1 | 2 | 3 | 4 | 5 = 5;

  public constructor(hive: Hive, ref: string) {
    this.hive = hive;
    this.ref = prefix.master + ref;

    Apiary.masters[this.ref] = this;
  }

  public get targetBeeCount() {
    return this._targetBeeCount;
  }

  public set targetBeeCount(value) {
    this._targetBeeCount = value;
  }

  public get oldestSpawn() {
    return this._oldestSpawn;
  }

  public set oldestSpawn(value) {
    this._oldestSpawn = value;
  }

  public get boosts() {
    return this._boosts;
  }

  public set boosts(value) {
    this._boosts = value;
  }

  public get hiveName() {
    return this.hive.roomName;
  }

  public _doUnboosting = false;
  public get doUnboosting() {
    return !!this.hive.mode.unboost && this._doUnboosting;
  }
  public set doUnboosting(value) {
    this._doUnboosting = value;
  }

  // some idiot (me) overloads these 3 functions down the road so we make them methods
  /** catch a bee after it has requested a master */
  public newBee(bee: Bee) {
    newBee(this, bee);
  }
  /** deletes bee from memory of master */
  public deleteBee(beeRef: string) {
    deleteBee(this, beeRef);
  }
  /** checks if some of bees need replacement */
  public checkBees(spawnExtreme?: boolean, spawnCycle?: number) {
    return checkBees(this, spawnExtreme, spawnCycle);
  }

  /** extension of just delete where bee is not dead yet */
  public removeBee = removeBee;
  /** requests a bee from the hive */
  public wish = wish;

  // first stage of decision making like do i need to spawn new creeps
  public update(this: Master) {
    for (const ref in this.bees)
      if (!Apiary.bees[this.bees[ref].ref]) this.deleteBee(ref);
    this.activeBees = _.filter(this.bees, (b) => !b.creep.spawning);
    if (Game.time % 36 === 0)
      _.forEach(this.activeBees, (b) =>
        b.creep.notifyWhenAttacked(this.notify)
      );
  }

  /** sends to boos any bees with beeState, then frees them with chill status */
  public preRunBoost = preRunBoost;
  /** sets mastersResTarget for hive so that we can afford bees for sure */
  public secureBoostsHive = secureBoostsHive;

  /** recycles bees when they are not needed (unboost + energy recycle)
   *
   * recomended use to only recycle boosted bees
   */
  public recycleBee = recycleBee;

  // second stage of decision making like where do i need to move
  public abstract run(): void;

  public checkFlee = checkFlee;

  public delete() {
    for (const key in this.bees) {
      this.bees[key].master = undefined;
      this.bees[key].state = beeStates.idle;
      delete this.bees[key].target;
    }
    for (const key in this.hive.spawOrders)
      if (key.includes(this.ref)) delete this.hive.spawOrders[key];

    if (this.hive.bassboost)
      for (const key in this.hive.bassboost.spawOrders)
        if (key.includes(this.ref)) delete this.hive.bassboost.spawOrders[key];
    delete Apiary.masters[this.ref];
  }

  public get print(): string {
    const firstBee = this.bees[Object.keys(this.bees)[0]];
    let roomName = this.hiveName;
    if (firstBee && firstBee.pos) roomName = firstBee.pos.roomName;
    return `<a href=#!/room/${Game.shard.name}/${roomName}>["${this.ref}"]</a>`;
  }

  public get printBees(): string {
    let ans = this.print + ":\n";
    _.forEach(this.bees, (bee) => (ans += "\n" + bee.print));
    return ans;
  }
}
