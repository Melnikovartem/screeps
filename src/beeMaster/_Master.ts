import { makeId } from "../utils/other"

import type { Hive } from "../Hive";
import { Bee } from "../bee";

// i will need to do something so i can build up structure from memory
export abstract class Master {

  hive: Hive;
  ref: string;
  refCell: string; // if "" then constructed not from cell
  bees: Bee[] = [];

  constructor(hive: Hive, refCell: string) {
    this.hive = hive;
    this.ref = makeId(8);
    this.refCell = refCell;

    global.masters[this.ref] = this;

    this.updateCash(['hive', 'ref', 'refCell']);
  }

  // update keys or all keys
  updateCash(keys?: string[]) {
    if (!Memory.masters[this.ref])
      Memory.masters[this.ref] = {};

    _.forEach(keys || Object.entries(this), (values) => {
      let key: string = values[0];
      let value = values[1];

      if (typeof value == "string") {
        Memory.masters[this.ref][key] = value;
      } else if (value instanceof Structure || value instanceof Source) {
        Memory.masters[this.ref][key] = value.id;
      } else if (key == "hive") {
        Memory.masters[this.ref][key] = value.room.name;
      }
    });
  }

  static fromCash(ref: string) {
    if (!Memory.masters[ref])
      return;

    console.log("V----");
    _.forEach(Object.entries(this), (values) => {
      let key: string = values[0];
      let value = values[1];

      console.log(key, value);
    });
    console.log("-----");
    _.forEach(Memory.masters[ref], (value, key) => {
      console.log(key, value);
    });
    console.log("^----");
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

}
