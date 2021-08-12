// import { makeId } from "../utils/other";

import { SpawnOrder, Hive } from "../Hive";
import { Bee } from "../bee";

// i will need to do something so i can build up structure from memory
export abstract class Master {

  hive: Hive;
  ref: string;

  targetBeeCount: number = 1;
  waitingForBees: number = 0;

  lastSpawns: number[] = [];
  beesAmount: number = 0;
  bees: { [id: string]: Bee } = {};

  constructor(hive: Hive, ref: string) {
    this.hive = hive;
    this.ref = ref;

    this.lastSpawns.push(0);

    global.masters[this.ref] = this;
  }

  // catch a bee after it has requested a master
  newBee(bee: Bee) {
    this.bees[bee.ref] = bee;
    if (this.waitingForBees)
      this.waitingForBees -= 1;

    let ticksToLive: number = bee.creep.ticksToLive ? bee.creep.ticksToLive : bee.lifeTime;
    let birthTime = Game.time - (bee.lifeTime - ticksToLive);
    if (this.beesAmount < this.targetBeeCount && this.targetBeeCount != 1) {
      this.lastSpawns.push(birthTime);
    } else if (birthTime >= this.lastSpawns[0]) {
      this.lastSpawns.shift();
      this.lastSpawns.push(birthTime);
    }
    this.beesAmount += 1;
  }

  checkBees(spawnCycle?: number): boolean {
    if (!spawnCycle)
      spawnCycle = CREEP_LIFE_TIME;

    // 5 for random shit
    return !this.waitingForBees && (this.beesAmount < this.targetBeeCount || Game.time + 5 >= this.lastSpawns[0] + spawnCycle);
  }

  // first stage of decision making like do i need to spawn new creeps
  update() {
    this.beesAmount = 0; // Object.keys(this.bees).length
    for (let key in this.bees) {
      this.beesAmount += 1;
      if (!global.bees[this.bees[key].ref])
        delete this.bees[key];
    }
  }

  wish(order: SpawnOrder) {
    this.waitingForBees += order.amount;
    this.hive.wish(order);
    // well he placed an order now just need to catch a creep after a spawn
  }

  // second stage of decision making like where do i need to move
  abstract run(): void;

  print(info: any) {
    console.log(Game.time, "!", this.ref, "?", info);
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
          if (typeof value == "string") {
            Memory.masters[this.ref][key] = value;
          } else if (value instanceof Structure || value instanceof Source) {
            Memory.masters[this.ref][key] = { id: value.id };
          } else if (key == "hive") {
            Memory.masters[this.ref][key] = value.room.name;
          } else if (Array.isArray(value) && value[0] instanceof Structure) {
            Memory.masters[this.ref][key] = _.map(value, (structure: Structure) => structure.id);
          }
        }
      });
    }

    static fromCash(ref: string): Master | null {

      console.log("V----");
      for (let key in Memory.masters[ref]) {
        let value = Memory.masters[ref][key];

        if (value.id) {
          let gameObject = Game.getObjectById(value.id)
          if (!gameObject)
            return null;

          console.log(key, gameObject);
          // set this parameter to new class object
        } else {
          // set this parameter to new class object
          console.log(key, value);
        }
        ;
      }
      console.log("^----");

      return null;
    }
  */
}
