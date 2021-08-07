import { Cell } from "./_Cell";
import { Hive } from "../Hive";
import { makeId } from "../utils/other"

export class respawnCell extends Cell {
  spawns: StructureSpawn[];
  freeSpawns: StructureSpawn[] = [];

  constructor(hive: Hive, spawns: StructureSpawn[]) {
    super(hive, "excavationCell_" + hive.room.name);

    this.spawns = spawns;
  }

  // first stage of decision making like do i a logistic transfer do i need more beeMasters
  update() {
    // find free spawners
    this.freeSpawns = _.filter(this.spawns, (structure) => structure.spawning == null);
  };

  // second stage of decision making like where do i need to spawn creeps or do i need
  run() {
    // generate the queue and start spawning
    _.some(this.hive.orderList, (order) => {
      if (!this.freeSpawns.length)
        return true;

      let body = order.setup.getBody(this.hive.room.energyAvailable);
      // if we were able to get a body :/
      if (body.length) {
        let spawn = this.freeSpawns.pop();

        let name = order.setup.bodySetup + " " + makeId(4);
        let memory: CreepMemory = {
          ref: order.master.ref
        };

        let ans = spawn!.spawnCreep(body, name, { memory: memory });

        if (ans == ERR_NOT_ENOUGH_RESOURCES) {
          return true;
        }
      }

      return false;
    });
  };
}
