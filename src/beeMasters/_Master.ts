// import { makeId } from "../utils/other";
import { hiveStates, beeStates, prefix } from "../enums";

import { profile } from "../profiler/decorator";
import type { SpawnOrder, Hive } from "../Hive";
import type { Bee } from "../bees/bee";
import type { BoostRequest } from "../cells/stage1/laboratoryCell";

export type Boosts = BoostRequest[];

// i will need to do something so i can build up structure from memory
@profile
export abstract class Master {

  readonly hive: Hive;
  readonly ref: string;

  targetBeeCount: number = 1;
  waitingForBees: number = 0;
  notify = true;

  oldestSpawn: number;
  beesAmount: number = 0;
  bees: { [id: string]: Bee } = {};
  activeBees: Bee[] = [];
  boosts: undefined | Boosts;
  boostTier: 0 | 1 | 2 | 3 = 0;
  movePriority: 0 | 1 | 2 | 3 | 4 | 5 = 5;

  constructor(hive: Hive, ref: string) {
    this.hive = hive;
    this.ref = prefix.master + ref;

    this.oldestSpawn = -1;

    Apiary.masters[this.ref] = this;
  }

  // catch a bee after it has requested a master
  newBee(bee: Bee) {
    if (bee.state === beeStates.idle)
      bee.state = this.boosts && this.hive.cells.lab && bee.ticksToLive > 1200 ? beeStates.boosting : beeStates.chill;
    this.bees[bee.ref] = bee;
    if (this.waitingForBees)
      this.waitingForBees -= 1;

    ++this.beesAmount;
    this.oldestSpawn = _.reduce(this.bees, (prev: Bee, curr) => curr.creep.memory.born < prev.creep.memory.born ? curr : prev).creep.memory.born;
  }

  deleteBee(ref: string) {
    delete this.bees[ref];
    this.beesAmount = Object.keys(this.bees).length;
    if (this.beesAmount)
      this.oldestSpawn = _.reduce(this.bees, (prev: Bee, curr) => curr.creep.memory.born < prev.creep.memory.born ? curr : prev).creep.memory.born;
  }

  removeBee(bee: Bee) {
    bee.master = undefined;
    bee.memory.refMaster = "";
    bee.state = beeStates.chill;
    this.deleteBee(bee.ref);
  }

  checkBees(spawnExtreme: boolean = false, spawnCycle: number = CREEP_LIFE_TIME - 10): boolean {
    // in 4 ifs to be able to read...
    if (this.waitingForBees || this.targetBeeCount === 0)
      return false;
    if (!spawnExtreme && this.hive.state !== hiveStates.economy)
      return false;
    if ((this.hive.bassboost || this.hive).cells.defense.timeToLand < spawnCycle / 2)
      return false;
    return this.targetBeeCount > this.beesAmount || (this.beesAmount === this.targetBeeCount && Game.time >= this.oldestSpawn + spawnCycle);
  }

  // first stage of decision making like do i need to spawn new creeps
  update() {
    for (const ref in this.bees)
      if (!Apiary.bees[this.bees[ref].ref])
        this.deleteBee(ref);
    this.activeBees = _.filter(this.bees, b => !b.creep.spawning);
    if (Game.time % 36 === 0)
      _.forEach(this.activeBees, b => b.creep.notifyWhenAttacked(this.notify));
  }

  wish(template: { setup: SpawnOrder["setup"], priority: SpawnOrder["priority"] }, ref: string = this.ref) {
    let order: SpawnOrder = {
      setup: template.setup.copy(),
      priority: template.priority,
      master: this.ref,
      ref: ref,
      createTime: Game.time,
    }
    if (this.hive.bassboost && this.hive.bassboost.state === hiveStates.economy) {
      let localBodyMax = 0;
      if (this.hive.state !== hiveStates.nospawn) {
        if (order.priority > 3)
          localBodyMax = order.setup.getBody(this.hive.room.energyCapacityAvailable).body.length;
        else
          localBodyMax = order.setup.getBody(this.hive.room.energyAvailable).body.length;
      }
      if (localBodyMax >= order.setup.getBody(this.hive.bassboost.room.energyCapacityAvailable).body.length)
        this.hive.spawOrders[ref] = order;
      else {
        order.priority = 9;
        this.hive.bassboost.spawOrders[ref] = order;
      }
    } else
      this.hive.spawOrders[ref] = order;
    this.waitingForBees += 1;
    // well he placed an order now just need to catch a creep after a spawn
  }

  // second stage of decision making like where do i need to move
  abstract run(): void;

  checkFlee(bee: Bee, fleeTo?: ProtoPos, opts?: TravelToOptions) {
    let pos = bee.pos;
    if (bee.targetPosition)
      pos = (bee.targetPosition.roomName === pos.roomName && bee.targetPosition.getEnteranceToRoom()) || bee.targetPosition;
    let roomInfo = Apiary.intel.getInfo(bee.pos.roomName, 25);
    if (pos.roomName !== bee.pos.roomName && Game.time - roomInfo.lastUpdated > 0 && Game.time - roomInfo.lastUpdated <= 20 && !roomInfo.safePlace) {
      if (bee.pos.getEnteranceToRoom())
        bee.flee(fleeTo || this.hive);
      else
        bee.targetPosition = undefined;
      return true;
    }
    let enemies = <Creep[]>roomInfo.enemies.map(e => e.object).filter(e => {
      if (!(e instanceof Creep))
        return false;
      let stats = Apiary.intel.getStats(e).current;
      return !!(stats.dmgClose + stats.dmgRange);
    });
    let enemy = bee.pos.findClosest(enemies);
    if (!enemy)
      return false;
    let contr = Game.rooms[bee.pos.roomName].controller;
    if (!contr || !contr.my || !contr.safeMode) {
      let fleeDist = Apiary.intel.getFleeDist(enemy);
      if (enemy.pos.getRangeTo(pos) === fleeDist + 1 && enemy.pos.getRangeTo(bee.pos) > fleeDist)
        bee.targetPosition = bee.pos;
      else if (enemy.pos.getRangeTo(pos) <= fleeDist || enemy.pos.getRangeTo(bee.pos) <= fleeDist) {
        bee.flee(fleeTo || this.hive, opts);
        return true;
      }
    }
    return false;
  }

  delete() {
    for (const key in this.bees) {
      this.bees[key].master = undefined;
      this.bees[key].state = beeStates.idle;
      delete this.bees[key].target;
    }
    for (const key in this.hive.spawOrders)
      if (key.includes(this.ref))
        delete this.hive.spawOrders[key];

    if (this.hive.bassboost)
      for (const key in this.hive.bassboost.spawOrders)
        if (key.includes(this.ref))
          delete this.hive.bassboost.spawOrders[key];
    delete Apiary.masters[this.ref];
  }

  get print(): string {
    let firstBee = this.bees[Object.keys(this.bees)[0]];
    let roomName = this.hive.roomName;
    if (firstBee && firstBee.pos)
      roomName = firstBee.pos.roomName;
    return `<a href=#!/room/${Game.shard.name}/${roomName}>["${this.ref}"]</a>`;
  }
}
