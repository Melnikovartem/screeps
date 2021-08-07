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
    let remove: any[] = [];
    _.some(this.hive.orderList, (order, key) => {
      if (!this.freeSpawns.length)
        return true;

      if (order.amount <= 0 || !global.masters[order.master]) {
        remove.push(this.hive.orderList[key]);
      } else {
        let body = order.setup.getBody(this.hive.room.energyAvailable);
        // if we were able to get a body :/
        if (body.length) {
          let spawn = this.freeSpawns.pop();

          let name = order.setup.name + " " + makeId(4);
          let memory: CreepMemory = {
            refMaster: order.master
          };

          let ans = spawn!.spawnCreep(body, name, { memory: memory });

          if (ans == ERR_NOT_ENOUGH_RESOURCES) {
            return true;
          }
          order.amount -= 1;
        }
      }

      return false;
    });

    _.forEach(remove.reverse(), (key) => {
      this.hive.orderList.splice(key, 1);
    });
  };
}
