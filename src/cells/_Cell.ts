import { Hive } from "../Hive";
import { Master } from "../beeMaster/_Master";

export abstract class Cell {

  hive: Hive;
  name: string;
  master: Master | undefined;

  constructor(hive: Hive, cellName: string) {
    this.hive = hive;
    this.name = cellName;
  }

  // first stage of decision making like do i a logistic transfer do i need more beeMasters
  abstract update(): void;

  // second stage of decision making like where do i need to spawn creeps or do i need
  abstract run(): void;
}
