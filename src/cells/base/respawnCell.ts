import { Cell } from "../_Cell";
import { Hive } from "../../Hive";

import { makeId } from "../../utils";
import { queenMaster } from "../../beeMasters/economy/queen";
import { profile } from "../../profiler/decorator";

@profile
export class respawnCell extends Cell {
  spawns: { [id: string]: StructureSpawn } = {};
  freeSpawns: StructureSpawn[] = [];
  extensions: { [id: string]: StructureExtension } = {};
  master: queenMaster | undefined;


  constructor(hive: Hive) {
    super(hive, "RespawnCell_" + hive.room.name);
    if (this.hive.stage > 0)
      this.master = new queenMaster(this);
  }

  update() {
    super.update(["extensions", "spawns"]);

    // find free spawners
    this.freeSpawns = _.filter(_.map(this.spawns), (structure) => structure.spawning === null);
  };

  run() {
    // generate the queue and start spawning
    let energyAvailable = this.hive.room.energyAvailable;
    let sortedOrders = _.map(this.hive.spawOrders,
      (order, ref) => { return { order: order, master: order.master ? order.master : ref!, ref: ref! } })
      .sort((a, b) => a.order.priority - b.order.priority);
    for (let key = 0; key < sortedOrders.length; ++key) {
      if (!this.freeSpawns.length)
        break;

      let order = sortedOrders[key].order;
      let spawn = this.freeSpawns.pop()!;

      let setup;
      // 1 - army emergency priority 4 - army long run priority (mostly cause pvp is not automated yet)
      if (order.priority < 4 || order.priority === 1)
        setup = order.setup.getBody(energyAvailable);
      else
        setup = order.setup.getBody(this.hive.room.energyCapacityAvailable);

      if (setup.body.length) {
        let name = order.setup.name + " " + makeId(4);
        let memory: CreepMemory = {
          refMaster: sortedOrders[key].master,
          born: Game.time,
        };

        let ans = spawn.spawnCreep(setup.body, name, { memory: memory });

        if (ans === OK) {

          if (Apiary.logger)
            Apiary.logger.newSpawn(name, spawn, setup.cost, order.priority, sortedOrders[key].master);

          energyAvailable -= setup.cost;
          this.hive.spawOrders[sortedOrders[key].ref].amount -= 1;
          if (this.hive.spawOrders[sortedOrders[key].ref].amount === 0)
            delete this.hive.spawOrders[sortedOrders[key].ref];
        }
      }
    }
  };
}
