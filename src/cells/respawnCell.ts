import { Cell } from "./_Cell";
import { Hive } from "../Hive";
import { makeId } from "../utils/other"

export class respawnCell extends Cell {
  spawns: StructureSpawn[];
  freeSpawns: StructureSpawn[] = [];

  constructor(hive: Hive, spawners: StructureSpawn[]) {
    super(hive, "excavationCell");

    this.spawns = spawners;
  }

  // first stage of decision making like do i a logistic transfer do i need more beeMasters
  update() {
    // find free spawners
    this.freeSpawns = _.filter(this.spawns, (structure) => structure.spawning == null);
  };

  // second stage of decision making like where do i need to spawn creeps or do i need
  run() {
    // generate the queue and start spawning
    _.forEach(this.hive.orderList, (order) => {
      if (!this.freeSpawns.length)
        return;

      let spawn = this.freeSpawns.pop();

      let body = order.setup.getBody(this.hive.room.energyAvailable);
      let name = order.setup.bodySetup + " " + makeId(4);
      let memory: CreepMemory = {
        ref: order.master.ref
      };

      let ans = spawn!.spawnCreep(body, name, { memory: memory });

      if (ans == ERR_NOT_ENOUGH_RESOURCES) {
        return;
      }
    });
  };
}
