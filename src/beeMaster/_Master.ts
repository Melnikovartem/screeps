import { Hive } from "../Hive";

// i will need to do something so i can build up structure from memory
export abstract class Master {

  hive: Hive;

  constructor(hive: Hive) {
    this.hive = hive;
  }

  // first stage of decision making like do i need to spawn new creeps
  abstract update(): void;

  // second stage of decision making like where do i need to move
  abstract run(): void;

}
