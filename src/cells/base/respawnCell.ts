import { Cell } from "../_Cell";
import { Hive } from "../../Hive";

import { makeId } from "../../utils";
import { queenMaster } from "../../beeMaster/economy/queen";
import { LOGGING_CYCLE } from "../../settings";
import { profile } from "../../profiler/decorator";

@profile
export class respawnCell extends Cell {
  spawns: StructureSpawn[] = [];
  freeSpawns: StructureSpawn[] = [];
  extensions: StructureExtension[] = [];


  constructor(hive: Hive) {
    super(hive, "RespawnCell_" + hive.room.name);
  }

  update() {
    super.update();

    // find free spawners
    this.freeSpawns = _.filter(this.spawns, (structure) => structure.spawning == null);
    if (!this.beeMaster && this.hive.stage > 0)
      this.beeMaster = new queenMaster(this);
  };

  run() {
    // generate the queue and start spawning
    let energyAvailable = this.hive.room.energyAvailable;
    let sortedOrders = _.map(this.hive.spawOrders, (order, master) => { return { order: order, master: master! } }).sort((a, b) => a.order.priority - b.order.priority);
    for (const key in sortedOrders) {
      if (!this.freeSpawns.length)
        break;

      let order = sortedOrders[key].order; {
        let spawn = this.freeSpawns.pop()!;

        let setup;
        if (order.priority < 4)
          setup = order.setup.getBody(energyAvailable);
        else
          setup = order.setup.getBody(this.hive.room.energyCapacityAvailable);

        if (setup.body.length) {
          let name = order.setup.name + "_" + makeId(4);
          let memory: CreepMemory = {
            refMaster: sortedOrders[key].master,
            born: Game.time,
          };

          let ans = spawn.spawnCreep(setup.body, name, { memory: memory });

          if (ans == OK) {
            energyAvailable -= setup.cost;
            if (LOGGING_CYCLE) Memory.log.spawns[name] = {
              time: Game.time,
              spawnRoom: this.hive.roomName,
              fromSpawn: spawn!.name,
              orderedBy: sortedOrders[key].master,
              priority: order.priority,
            };

            this.hive.spawOrders[sortedOrders[key].master].amount -= 1;
            if (this.hive.spawOrders[sortedOrders[key].master].amount == 0)
              delete this.hive.spawOrders[sortedOrders[key].master];
          }
        }
      }
    }
  };
}
