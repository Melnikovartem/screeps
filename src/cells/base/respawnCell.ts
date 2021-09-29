import { Cell } from "../_Cell";

import { beeStates } from "../../enums";
import { makeId } from "../../abstract/utils";
import { prefix } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Hive } from "../../Hive";

@profile
export class RespawnCell extends Cell {
  spawns: { [id: string]: StructureSpawn } = {};
  freeSpawns: StructureSpawn[] = [];
  extensions: { [id: string]: StructureExtension } = {};
  master: undefined;

  roadMap: number[][] = [];


  constructor(hive: Hive) {
    super(hive, prefix.respawnCell + hive.room.name);
  }

  update() {
    super.update(["extensions", "spawns"]);

    // find free spawners
    this.freeSpawns = _.filter(_.map(this.spawns), structure => !structure.spawning);
    this.hive.stateChange("nospawn", !Object.keys(this.spawns).length);

    let targets: (StructureSpawn | StructureExtension)[] = _.filter(this.spawns, s => s.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
    targets = _.filter(targets.concat(_.map(this.extensions)), s => s.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
    targets.sort((a, b) => this.roadMap[a.pos.x][a.pos.y] - this.roadMap[b.pos.x][b.pos.y]);
    let storageCell = this.hive.cells.storage;
    if (storageCell)
      storageCell!.requestFromStorage(targets, 1);
  };

  bakeMap() {
    this.roadMap = [];
    for (let x = 0; x <= 49; ++x) {
      this.roadMap[x] = [];
      for (let y = 0; y <= 49; ++y)
        this.roadMap[x][y] = Infinity;
    }

    let poss: RoomPosition[] = _.map(this.spawns, s => s.pos).concat(_.map(this.extensions, s => s.pos));

    // it won't compute some edge cases with strange trerrain but this is good enough (cause we refill edge extensions last)
    this.dfs(this.pos, 0, Math.max(..._.map(poss, p => this.pos.getRangeTo(p))));
  }

  dfs(p: RoomPosition, depth: number, maxRange: number) {
    if (this.roadMap[p.x][p.y] !== Infinity)
      return depth - 1;
    if (p.getRangeTo(this.pos) > maxRange)
      return depth - 1;

    this.roadMap[p.x][p.y] = depth;
    _.forEach(p.getPositionsInRange(1), pp => {
      if (pp.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN).length || pp.isFree(true))
        depth = this.dfs(pp, depth + 1, maxRange);
    });
    return depth;
  }

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
      if (!Apiary.masters[sortedOrders[key].master]) {
        this.hive.spawOrders[sortedOrders[key].ref].amount = 0;
        continue
      }

      let spawn = this.freeSpawns.pop()!;

      let setup;
      // 1 - army emergency priority 4 - army long run priority (mostly cause pvp is not automated yet)
      let moveMax = undefined;
      if (moveMax === "best" && Apiary.masters[sortedOrders[key].master] && Apiary.masters[sortedOrders[key].master].boostMove
        && this.hive.cells.lab && this.hive.cells.lab.getMineralSum(RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE) >= LAB_BOOST_MINERAL * 10)
        moveMax = 10;

      if (order.priority === 0 && (!this.hive.cells.storage || !this.hive.cells.storage.master.beesAmount))
        setup = order.setup.getBody(energyAvailable, moveMax);
      else
        setup = order.setup.getBody(this.hive.room.energyCapacityAvailable, moveMax);

      if (setup.body.length) {
        let name = order.setup.name + " " + makeId(4);
        let memory: CreepMemory = {
          refMaster: sortedOrders[key].master,
          born: Game.time,
          state: beeStates.idle,
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
    if (this.hive.phase === 0) // renewing Boost creeps if they are better than we can spawn
      _.forEach(this.freeSpawns, s => {
        let creep = s.pos.findInRange(FIND_MY_CREEPS, 1).filter(c => c.body.length > Math.floor(this.hive.room.energyCapacityAvailable / 200) * 3)[0];
        if (creep && creep.ticksToLive && CREEP_LIFE_TIME - creep.ticksToLive >= 200)
          s.renewCreep(creep);
      });
  }
}
