import { Cell } from "../_Cell";
import { QueenMaster } from "../../beeMasters/economy/queen";

import { beeStates } from "../../enums";
import { makeId } from "../../abstract/utils";

import { profile } from "../../profiler/decorator";
import type { Hive } from "../../Hive";

@profile
export class RespawnCell extends Cell {
  spawns: { [id: string]: StructureSpawn } = {};
  freeSpawns: StructureSpawn[] = [];
  extensions: { [id: string]: StructureExtension } = {};
  master: QueenMaster | undefined;


  constructor(hive: Hive) {
    super(hive, "RespawnCell_" + hive.room.name);
    if (this.hive.stage > 0)
      this.master = new QueenMaster(this);
    this.pos = this.hive.getPos("spawn");
  }

  update() {
    super.update(["extensions", "spawns"]);

    // find free spawners
    this.freeSpawns = _.filter(_.map(this.spawns), (structure) => structure.spawning === null);

    this.hive.stateFromEconomy("nospawn", !Object.keys(this.spawns).length);
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
      let moveMax = undefined;
      if (moveMax === "best" && Apiary.masters[sortedOrders[key].master] && Apiary.masters[sortedOrders[key].master].boost
        && this.hive.cells.lab && this.hive.cells.lab.getMineralSum(RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE) >= LAB_BOOST_MINERAL * 10)
        moveMax = 10;

      if (order.priority === 0)
        setup = order.setup.getBody(energyAvailable, moveMax);
      else
        setup = order.setup.getBody(this.hive.room.energyCapacityAvailable, moveMax);

      if (setup.body.length) {
        let name = order.setup.name + " " + makeId(4);
        let memory: CreepMemory = {
          refMaster: sortedOrders[key].master,
          born: Game.time,
          state: beeStates.idle,
          target: null,
        };

        if (setup.cost > energyAvailable)
          break;

        let ans = spawn.spawnCreep(setup.body, name, { memory: memory });

        if (ans === OK) {

          if (Apiary.logger)
            Apiary.logger.newSpawn(name, spawn, setup.cost, order.priority, sortedOrders[key].master);

          energyAvailable -= setup.cost;
          this.hive.spawOrders[sortedOrders[key].ref].amount -= 1;
          if (this.hive.spawOrders[sortedOrders[key].ref].amount === 0)
            delete this.hive.spawOrders[sortedOrders[key].ref];
        }
      } else
        break;
    }
  };
}
