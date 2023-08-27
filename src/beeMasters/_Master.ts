// import { makeId } from "../utils/other";
import type { Bee } from "../bees/bee";
import type { ProtoBee } from "../bees/protoBee";
import type { BoostRequest } from "../cells/stage1/laboratoryCell";
import type { Hive, SpawnOrder } from "../hive/hive";
import { profile } from "../profiler/decorator";
import { beeStates, hiveStates, prefix, roomStates } from "../static/enums";

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

  // catch a bee after it has requested a master
  public newBee(bee: Bee) {
    bee.memory.refMaster = this.ref;
    if (bee.state === beeStates.idle)
      bee.state =
        this.boosts && this.hive.cells.lab && bee.ticksToLive > 1200
          ? beeStates.boosting
          : beeStates.chill;
    this.bees[bee.ref] = bee;
    if (this.waitingForBees) this.waitingForBees -= 1;

    ++this.beesAmount;
    this.oldestSpawn = _.reduce(this.bees, (prev: Bee, curr) =>
      curr.creep.memory.born < prev.creep.memory.born ? curr : prev
    ).creep.memory.born;
  }

  public deleteBee(ref: string) {
    delete this.bees[ref];
    delete this.stcukEnterance[ref];
    for (let i = 0; i < this.activeBees.length; ++i)
      if (this.activeBees[i].ref == ref) {
        this.activeBees.splice(i, 1);
        --i;
      }
    this.beesAmount = Object.keys(this.bees).length;
    if (this.beesAmount)
      this.oldestSpawn = _.reduce(this.bees, (prev: Bee, curr) =>
        curr.creep.memory.born < prev.creep.memory.born ? curr : prev
      ).creep.memory.born;
  }

  public removeBee(bee: Bee) {
    bee.master = undefined;
    bee.memory.refMaster = "";
    bee.state = beeStates.chill;
    this.deleteBee(bee.ref);
  }

  public checkBees(
    spawnExtreme: boolean = false,
    spawnCycle: number = CREEP_LIFE_TIME - 10
  ): boolean {
    // in 4 ifs to be able to read...
    if (this.waitingForBees || this.targetBeeCount === 0) return false;
    if (!spawnExtreme && this.hive.state !== hiveStates.economy) return false;
    if (
      (this.hive.bassboost || this.hive).cells.defense.timeToLand <
      spawnCycle / 2
    )
      return false;
    return (
      this.targetBeeCount > this.beesAmount ||
      (this.beesAmount === this.targetBeeCount &&
        Game.time >= this.oldestSpawn + spawnCycle)
    );
  }

  // first stage of decision making like do i need to spawn new creeps
  public update() {
    for (const ref in this.bees)
      if (!Apiary.bees[this.bees[ref].ref]) this.deleteBee(ref);
    this.activeBees = _.filter(this.bees, (b) => !b.creep.spawning);
    if (Game.time % 36 === 0)
      _.forEach(this.activeBees, (b) =>
        b.creep.notifyWhenAttacked(this.notify)
      );
  }

  public wish(
    template: { setup: SpawnOrder["setup"]; priority: SpawnOrder["priority"] },
    ref: string = this.ref
  ) {
    const order: SpawnOrder = {
      setup: template.setup.copy(),
      priority: template.priority,
      master: this.ref,
      ref,
      createTime: Game.time,
    };
    if (this.hive.bassboost) {
      let localBodyMax = 0;
      if (this.hive.state !== hiveStates.nospawn) {
        if (order.priority > 0)
          localBodyMax = order.setup.getBody(
            this.hive.room.energyCapacityAvailable
          ).body.length;
        else
          localBodyMax = order.setup.getBody(this.hive.room.energyAvailable)
            .body.length;
      }
      if (
        localBodyMax >=
        order.setup.getBody(this.hive.bassboost.room.energyCapacityAvailable)
          .body.length
      ) {
        this.hive.spawOrders[ref] = order;
        this.waitingForBees += 1;
      } else if (this.hive.bassboost.state === hiveStates.economy) {
        order.priority = order.priority ? 9 : 5;
        this.hive.bassboost.spawOrders[ref] = order;
        this.waitingForBees += 1;
      }
    } else {
      this.hive.spawOrders[ref] = order;
      this.waitingForBees += 1;
    }
    // well he placed an order now just need to catch a creep after a spawn
  }

  // second stage of decision making like where do i need to move
  public abstract run(): void;

  public checkFlee(
    bee: ProtoBee<Creep | PowerCreep>,
    fleePos?: { pos: RoomPosition },
    opt?: TravelToOptions,
    stop: boolean = true,
    lag = 30
  ) {
    let pos = bee.pos;
    if (bee.targetPosition)
      pos =
        (bee.targetPosition.roomName === pos.roomName &&
          bee.targetPosition.enteranceToRoom) ||
        bee.targetPosition;
    const roomInfo = Apiary.intel.getInfo(pos.roomName, lag);
    if (
      pos.roomName !== bee.pos.roomName &&
      Game.time - roomInfo.lastUpdated <= 20 &&
      !roomInfo.safePlace &&
      stop
    ) {
      const hive = Apiary.hives[pos.roomName];
      if (!hive || hive.cells.defense.isBreached) {
        if (bee.pos.enteranceToRoom)
          bee.flee(
            (fleePos && fleePos.pos) || bee.movePosition || this.hive.pos
          );
        else {
          bee.stop();
          bee.targetPosition = bee.pos;
          if (bee.movePosition && bee.movePosition.roomName !== pos.roomName) {
            if (!this.stcukEnterance[bee.ref]) this.stcukEnterance[bee.ref] = 0;
            ++this.stcukEnterance[bee.ref]!;
            if (this.stcukEnterance[bee.ref]! > 10 && bee.memory._trav) {
              bee.memory._trav.path = undefined;
              this.stcukEnterance[bee.ref] = undefined;
            }
          }
        }
      }
      return true;
    }
    const enemies = roomInfo.enemies
      .filter((e) => {
        if (!(e.object instanceof Creep)) return false;
        const stats = Apiary.intel.getStats(e.object).current;
        return !!(stats.dmgClose + stats.dmgRange);
      })
      .map((e) => e.object) as Creep[];
    const enemy = bee.pos.findClosest(enemies);
    if (!enemy) return false;
    if (
      roomInfo.roomState !== roomStates.ownedByMe ||
      roomInfo.safeModeEndTime < Game.time
    ) {
      const fleeDist = Apiary.intel.getFleeDist(enemy);
      const fleeTo = (fleePos && fleePos.pos) || bee.movePosition || null;
      if (
        ((enemy.pos.getRangeTo(pos) === fleeDist + 1 &&
          enemy.pos.getRangeTo(bee) > fleeDist) ||
          (fleeTo &&
            enemy.pos.getRangeTo(fleeTo) < bee.pos.getRangeTo(fleeTo) &&
            enemy.pos.getRangeTo(fleeTo) <= fleeDist)) && // we don't want to be coming closer to enemy
        stop
      ) {
        bee.stop();
        bee.targetPosition = bee.pos;
      } else if (
        enemy.pos.getRangeTo(pos) <= fleeDist ||
        enemy.pos.getRangeTo(bee.pos) <= fleeDist
      ) {
        bee.flee(fleeTo, opt);
        return true;
      }
    }
    return false;
  }

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
    let roomName = this.hive.roomName;
    if (firstBee && firstBee.pos) roomName = firstBee.pos.roomName;
    return `<a href=#!/room/${Game.shard.name}/${roomName}>["${this.ref}"]</a>`;
  }

  public get printBees(): string {
    let ans = this.print + ":\n";
    _.forEach(this.bees, (bee) => (ans += "\n" + bee.print));
    return ans;
  }
}
