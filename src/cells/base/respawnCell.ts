import { Cell } from "../_Cell";
import { Hive } from "../../Hive";

import { makeId } from "../../utils";
import { queenMaster } from "../../beeMaster/civil/queen";
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
    let remove: any[] = [];
    let energyAvailable = this.hive.room.energyAvailable;
    this.hive.orderList.sort((a, b) => a.priority - b.priority);

    _.some(this.hive.orderList, (order, key) => {
      if (!this.freeSpawns.length)
        return true;

      if (order.amount <= 0 || !Apiary.masters[order.master]) {
        remove.push(key);
      } else {
        let setup;
        if (order.priority < 4)
          setup = order.setup.getBody(energyAvailable);
        else
          setup = order.setup.getBody(this.hive.room.energyCapacityAvailable);

        // if we were able to get a body :/
        if (setup.body.length) {
          let spawn = this.freeSpawns.pop()!;

          let name = order.setup.name + " " + makeId(4);
          let memory: CreepMemory = {
            refMaster: order.master,
            born: Game.time,
          };

          let ans = spawn.spawnCreep(setup.body, name, { memory: memory });

          if (ans == OK) {
            energyAvailable -= setup.cost;
            if (LOGGING_CYCLE) Memory.log.spawns[name] = {
              time: Game.time,
              spawnRoom: this.hive.roomName,
              fromSpawn: spawn!.name,
              orderedBy: order.master,
            };

            this.hive.orderList[key].amount -= 1;
          }
        }
      }

      return false;
    });

    if (remove.length)
      _.forEach(remove.reverse(), (key) => {
        this.hive.orderList.splice(key, 1);
      });
  };
}
