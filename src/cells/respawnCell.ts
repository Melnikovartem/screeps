import { Cell } from "./_Cell";
import { Hive } from "../Hive";

export class respawnCell extends Cell {
  spawners: StructureSpawn[];

  constructor(hive: Hive, spawners: StructureSpawn[]) {
    super(hive, "excavationCell");

    this.spawners = spawners;
  }

  // first stage of decision making like do i a logistic transfer do i need more beeMasters
  update() {
    // find free spawners
  };

  // second stage of decision making like where do i need to spawn creeps or do i need
  run() {
    // generate the queue and start spawning
  };
}
