import { Hive } from "../Hive";

export abstract class Cell {

  hive: Hive;

  constructor(hive: Hive) {
    this.hive = hive;
  }

  // first stage of decision making like do i a logistic transfer
  abstract init(): void;

  // second stage of decision making like where do i need to spawn creeps or do i need
  abstract run(): void;
}
