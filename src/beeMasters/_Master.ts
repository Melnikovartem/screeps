// import { makeId } from "../utils/other";

import { SpawnOrder, Hive } from "../Hive";
import { Bee } from "../bee";
import { profile } from "../profiler/decorator";

// some states that masters can use in different ways
export enum states {
  idle = 0,
  chill = 1,
  work = 2,
  fflush = 3,
  refill = 4,
  boosting = 5,
}

// i will need to do something so i can build up structure from memory
@profile
export abstract class Master {

  hive: Hive;
  ref: string;

  targetBeeCount: number = 1;
  waitingForBees: number = 0;

  lastSpawns: number[];
  beesAmount: number = 0;
  bees: { [id: string]: Bee } = {};
  boost: boolean = false;

  constructor(hive: Hive, ref: string) {
    this.hive = hive;
    this.ref = "master" + ref;

    this.lastSpawns = [-1];

    Apiary.masters[this.ref] = this;
  }

  // catch a bee after it has requested a master
  newBee(bee: Bee) {
    bee.state = this.boost ? states.boosting : states.chill;
    this.bees[bee.ref] = bee;
    if (this.waitingForBees)
      this.waitingForBees -= 1;

    let birthTime = bee.creep.memory.born;

    this.lastSpawns.push(birthTime);
    if (this.lastSpawns[0] === -1)
      this.lastSpawns.shift();

    this.beesAmount += 1;
    this.lastSpawns.sort();
  }

  deleteBee(ref: string) {
    delete this.bees[ref];

    this.lastSpawns = [];
    _.forEach(this.bees, (bee) => {
      this.lastSpawns.push(bee.creep.memory.born);
    });
    this.lastSpawns.sort();
  }

  checkBees(spawnCycle?: number): boolean {
    if (!spawnCycle)
      spawnCycle = CREEP_LIFE_TIME;

    if (this.waitingForBees && !this.hive.spawOrders[this.ref]
      && (!this.hive.bassboost || !this.hive.bassboost.spawOrders[this.ref]))
      this.waitingForBees = 0;

    return !this.waitingForBees && this.targetBeeCount > 0 && (this.targetBeeCount > this.beesAmount
      || (this.beesAmount === this.targetBeeCount && Game.time >= this.lastSpawns[0] + spawnCycle));
  }

  // first stage of decision making like do i need to spawn new creeps
  update() {
    this.beesAmount = 0; // Object.keys(this.bees).length
    for (const ref in this.bees) {
      this.beesAmount += 1;
      if (!Apiary.bees[this.bees[ref].ref])
        this.deleteBee(ref);
    }
  }

  wish(order: SpawnOrder, ref: string = this.ref) {
    order.amount = Math.max(order.amount, 1);
    if (this.hive.bassboost) {
      if (order.setup.getBody(this.hive.bassboost.room.energyCapacityAvailable).cost <= this.hive.room.energyAvailable ||
        Object.keys(this.hive.bassboost.spawOrders).length > 5 && order.setup.getBody(this.hive.room.energyAvailable).body.length > 0) {
        order.amount = 1; // yey i can produce a minion locally or the main hive is just too busy ...
        this.hive.spawOrders[ref] = order;
      } else
        this.hive.bassboost.spawOrders[ref] = order;
      if (this.hive.room.energyCapacityAvailable >= 1000 && Apiary.orders["boost_" + this.hive.roomName] &&
        (this.hive.cells.storage && this.hive.cells.storage.storage.store[RESOURCE_ENERGY] > 10000))
        Apiary.orders["boost_" + this.hive.roomName].delete();
    } else
      this.hive.spawOrders[ref] = order;
    this.waitingForBees += order.amount;
    // well he placed an order now just need to catch a creep after a spawn
  }

  // second stage of decision making like where do i need to move
  abstract run(): void;

  delete() {
    for (const key in this.bees) {
      this.bees[key].master = undefined;
      this.bees[key].state = states.idle;
      this.bees[key].target = null;
    }
    for (const key in this.hive.spawOrders)
      if (key.includes(this.ref))
        delete this.hive.spawOrders[key];

    if (this.hive.bassboost)
      delete this.hive.bassboost.spawOrders[this.ref];
    delete Apiary.masters[this.ref];
  }

  get print(): string {
    let firstBee = this.bees[Object.keys(this.bees)[0]];
    let roomName = this.hive.roomName;
    if (firstBee && firstBee.pos)
      roomName = firstBee.pos.roomName;
    return `<a href=#!/room/${Game.shard.name}/${roomName}>["${this.ref}"]</a>`;
  }

  /*
  updateCash turnedOff for now
    // update keys or all keys
    // later to do it for all objects
    updateCash(keys: string[]) {
      if (!Memory.masters[this.ref])
        Memory.masters[this.ref] = {
          masterType: this.constructor.name
        };

      _.forEach(keys || Object.entries(this), (key) => {
        let value = (<any>this)[key];
        if (value) {
          if (typeof value === "string") {
            Memory.masters[this.ref][key] = value;
          } else if (value instanceof Structure || value instanceof Source) {
            Memory.masters[this.ref][key] = { id: value.id };
          } else if (key === "hive") {
            Memory.masters[this.ref][key] = value.room.name;
          } else if (Array.isArray(value) && value[0] instanceof Structure) {
            Memory.masters[this.ref][key] = _.map(value, (structure: Structure) => structure.id);
          }
        }
      });
    }

    static fromCash(ref: string): Master | null {

      for (const key in Memory.masters[ref]) {
        let value = Memory.masters[ref][key];

        if (value.id) {
          let gameObject = Game.getObjectById(value.id)
          if (!gameObject)
            return null;

          // set this parameter to new class object
        } else {
          // set this parameter to new class object
        }
        ;
      }

      return null;
    }
  */
}
