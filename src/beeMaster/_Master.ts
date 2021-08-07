// import { makeId } from "../utils/other"

import type { Hive } from "../Hive";
import { Bee } from "../bee";

// i will need to do something so i can build up structure from memory
export abstract class Master {

  hive: Hive;
  ref: string;
  bees: Bee[] = [];

  constructor(hive: Hive, ref: string) {
    this.hive = hive;
    this.ref = ref;

    global.masters[this.ref] = this;

    this.updateCash(['hive', 'ref']);
  }

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

  // catch a bee after it has requested a master
  catchBee(bee: Bee): void {
    this.bees.push(bee);
    this.newBee(bee);
  }

  abstract newBee(bee: Bee): void

  // first stage of decision making like do i need to spawn new creeps
  abstract update(): void;

  // second stage of decision making like where do i need to move
  abstract run(): void;

  print(info: any) {
    console.log(Game.time, "!", this.ref, "?", info);
  }
}
