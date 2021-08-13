import { Cell } from "./_Cell";
import { Hive } from "../Hive";

import { makeId } from "../utils/other";
import { queenMaster } from "../beeMaster/civil/queen";
import { LOGGING_CYCLE } from "../settings";
import { profile } from "../profiler/decorator";

@profile
export class respawnCell extends Cell {
  spawns: StructureSpawn[];
  freeSpawns: StructureSpawn[] = [];
  extensions: StructureExtension[];

  constructor(hive: Hive, spawns: StructureSpawn[], extensions: StructureExtension[]) {
    super(hive, "RespawnCell_" + hive.room.name);

    this.spawns = spawns;
    this.extensions = extensions;

    let flags = _.filter(this.hive.room.find(FIND_FLAGS), (flag) => flag.color == COLOR_CYAN && flag.secondaryColor == COLOR_GREEN);
    if (flags.length)
      this.pos = flags[0].pos;
    else if (this.hive.storage)
      this.pos = this.hive.storage.pos;
  }

  // first stage of decision making like do i a logistic transfer do i need more beeMasters
  update() {
    super.update();

    // find free spawners
    this.freeSpawns = _.filter(this.spawns, (structure) => structure.spawning == null);
    if (!this.beeMaster && this.hive.stage > 0)
      this.beeMaster = new queenMaster(this);
  };

  // second stage of decision making like where do i need to spawn creeps or do i need
  run() {
    // generate the queue and start spawning
    let remove: any[] = [];
    this.hive.orderList.sort((a, b) => a.priority - b.priority);

    _.some(this.hive.orderList, (order, key) => {
      if (!this.freeSpawns.length)
        return true;

      if (order.amount <= 0 || !global.masters[order.master]) {
        remove.push(key);
      } else {
        let body;
        if (order.priority < 4)
          body = order.setup.getBody(this.hive.room.energyAvailable);
        else
          body = order.setup.getBody(this.hive.room.energyCapacityAvailable);

        // if we were able to get a body :/
        if (body.length) {
          let spawn = this.freeSpawns.pop();

          let name = order.setup.name + " " + makeId(4);
          let memory: CreepMemory = {
            refMaster: order.master,
            born: Game.time,
          };

          let ans = spawn!.spawnCreep(body, name, { memory: memory });

          if (ans == ERR_NOT_ENOUGH_RESOURCES) {
            return true;
          }

          if (ans == OK) {
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
