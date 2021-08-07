import { Hive } from "../Hive";
import { Bee } from "../bee";
import { makeId } from "../utils/other"

// i will need to do something so i can build up structure from memory
export abstract class Master {

  hive: Hive;
  ref: string;

  constructor(hive: Hive) {
    this.hive = hive;
    this.ref = makeId(8);

    global.masters[this.ref] = this;
  }

  // catch a bee after it has requested a master
  abstract catchBee(bee: Bee): void;

  // first stage of decision making like do i need to spawn new creeps
  abstract update(): void;

  // second stage of decision making like where do i need to move
  abstract run(): void;

}
