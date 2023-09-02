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

export type MovePriority = 0 | 1 | 2 | 3 | 4 | 5;
export type Boosts = BoostRequest[];

export interface MasterParent {
  // #region Properties (3)

  hive: Hive;
  pos: RoomPosition;
  ref: string;

  // #endregion Properties (3)
}

// Master to keep working on some job
// Init each reset from underlying object (if from cell / hive) / memory (if it is a swarm)
@profile
export abstract class Master<T extends MasterParent> {
  // #region Properties (20)

  /** this.wish should be used only after checkBees is called. So we check if it happened */
  protected checkBeforeWish = false;
  protected oldestSpawn: number = -Infinity;

  public readonly ref: string;

  public activeBees: Bee[] = [];
  public bees: { [id: string]: Bee } = {};
  public beesAmount: number = 0;
  /** checks if some of bees need replacement */
  public checkBees = checkBees;
  public checkFlee = checkFlee;
  /** deletes bee from memory of master */
  public deleteBee = deleteBee;
  /** movePriority of bees that are part of this master */
  public abstract movePriority: MovePriority;
  /** catch a bee after it has requested a master */
  public newBee = newBee;
  public notify = false;
  public parent: T;
  /** sends to boos any bees with beeState, then frees them with chill status */
  public preRunBoost = preRunBoost;
  /** recycles bees when they are not needed (unboost + energy recycle)
   *
   * recomended use to only recycle boosted bees
   */
  public recycleBee = recycleBee;
  /** extension of just delete where bee is not dead yet */
  public removeBee = removeBee;
  /** sets mastersResTarget for hive so that we can afford bees for sure */
  public secureBoostsHive = secureBoostsHive;
  public stcukEnterance: { [id: string]: number | undefined } = {};
  public waitingForBees: number = 0;
  /** requests a bee from the hive */
  public wish = wish;

  // #endregion Properties (20)

  // #region Constructors (1)

  public constructor(parent: T, ref?: string) {
    // unpack parent object
    this.parent = parent;

    if (ref) this.ref = ref;
    else this.ref = prefix.master + this.parent.ref;

    // save in global dict for iteration
    Apiary.masters[this.ref] = this;
  }

  // #endregion Constructors (1)

  // #region Public Accessors (7)

  public get boosts(): BoostRequest[] {
    return [];
  }

  public get hive() {
    return this.parent.hive;
  }

  public get hiveName() {
    return this.hive.roomName;
  }

  public get pos() {
    return this.parent.pos;
  }

  // nice way to print info about this master
  public get print(): string {
    /* const firstBee = this.bees[Object.keys(this.bees)[0]];
    let roomName = this.hiveName;
    if (firstBee && firstBee.pos) roomName = firstBee.pos.roomName; */
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.ref}"]</a>`;
  }

  // nice way to print bees of this master
  public get printBees(): string {
    let ans = this.print + ":\n";
    _.forEach(this.bees, (bee) => (ans += "\n" + bee.print));
    return ans;
  }

  public get roomName() {
    return this.pos.roomName;
  }

  // #endregion Public Accessors (7)

  // #region Public Abstract Accessors (1)

  /** O(1) to get how many bees this master wants to have at each tick */
  public abstract get targetBeeCount(): number;

  // #endregion Public Abstract Accessors (1)

  // #region Public Methods (3)

  public delete() {
    for (const key in this.bees) {
      this.bees[key].master = undefined;
      this.bees[key].state = beeStates.idle;
      delete this.bees[key].target;
    }

    this.removeWishes();
    delete Apiary.masters[this.ref];
  }

  // remove all wishes for spawns that this master made
  public removeWishes() {
    this.removeFromQue(this.hive);
    if (this.hive.bassboost) this.removeFromQue(this.hive.bassboost);
  }

  // first stage of decision making like do i need to spawn new creeps
  public update() {
    this.checkBeforeWish = false;
    for (const ref in this.bees)
      if (!Apiary.bees[this.bees[ref].ref]) this.deleteBee(ref);
    this.activeBees = _.filter(this.bees, (b) => !b.creep.spawning);
  }

  // #endregion Public Methods (3)

  // #region Public Abstract Methods (1)

  // second stage of decision making like where do i need to move
  public abstract run(): void;

  // #endregion Public Abstract Methods (1)

  // #region Private Methods (1)

  private removeFromQue(hive: Hive) {
    const spawnQue = hive.cells.spawn.spawnQue;
    for (let i = 0; i < spawnQue.length; ++i)
      if (spawnQue[i].master === this.ref) {
        spawnQue.splice(i, 1);
        --i;
      }
  }

  // #endregion Private Methods (1)
}
