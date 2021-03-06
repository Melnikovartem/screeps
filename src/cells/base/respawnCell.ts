import { Cell } from "../_Cell";
import { FastRefillCell } from "../stage1/fastRefill";

import { beeStates, setupsNames } from "../../enums";
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

  fastRef: FastRefillCell | undefined;

  priorityMap: { [id: string]: number } = {};


  constructor(hive: Hive) {
    super(hive, prefix.respawnCell + "_" + hive.room.name);
  }

  spawnEval(spawn: StructureSpawn) {
    if (!spawn.effects)
      return 0;
    let powerup = <PowerEffect>spawn.effects.filter(e => e.effect === PWR_OPERATE_SPAWN)[0];
    if (powerup)
      return -powerup.level;
    return 0;
  }

  spawnDisrupted(spawn: StructureSpawn) {
    return spawn.effects && spawn.effects.filter(e => e.effect === PWR_DISRUPT_SPAWN).length;
  }

  get fastRefPos() {
    if (this.hive.cache.cells[prefix.fastRefillCell]) {
      let poss = this.hive.cache.cells[prefix.fastRefillCell].poss;
      return new RoomPosition(poss.x, poss.y, this.hive.roomName);
    }
    return undefined;
  }

  update() {
    super.update(["extensions", "spawns"]);

    if (!this.fastRef && this.hive.phase >= 1 && this.hive.cells.storage && this.fastRefPos) {
      let link = <StructureLink | undefined>this.fastRefPos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_LINK)[0];
      if (link)
        this.fastRef = new FastRefillCell(this, link, this.hive.cells.storage)
    }

    // find free spawners
    this.freeSpawns = _.filter(this.spawns, structure => !structure.spawning && !this.spawnDisrupted(structure));
    this.freeSpawns.sort((a, b) => this.spawnEval(b) - this.spawnEval(a));
    this.hive.stateChange("nospawn", !Object.keys(this.spawns).length);

    let storageCell = this.hive.cells.storage;
    if (storageCell)
      storageCell.requestFromStorage(this.getTargets(), 0, RESOURCE_ENERGY);
    if (this.fastRef)
      this.fastRef.update();
  }

  getTargets() {
    if (this.fastRef)
      this.fastRef.refillTargets = [];
    let targets = _.filter((<(StructureSpawn | StructureExtension)[]>
      Object.values(this.spawns)).concat(Object.values(this.extensions)), s => this.checkTarget(s));
    targets.sort((a, b) => (this.priorityMap[a.id] || Infinity) - (this.priorityMap[b.id] || Infinity));
    return targets;
  }

  checkTarget(s: StructureSpawn | StructureExtension) {
    if (s.store.getFreeCapacity(RESOURCE_ENERGY) <= 0 || (this.hive.cells.storage && this.hive.cells.storage.requests[s.id]))
      return false;
    if (this.fastRef && this.fastRef.pos.getRangeTo(s) <= 2)
      for (let i = 0; i < this.fastRef.masters.length; ++i) {
        let m = this.fastRef.masters[i];
        if (m.pos.getRangeTo(s) <= 1 && m.beesAmount) {
          this.fastRef.refillTargets.push(s);
          return false;
        }
      }
    return true;
  }

  bakePriority() {
    let poss: RoomPosition[] = _.map(this.spawns, s => s.pos).concat(_.map(this.extensions, s => s.pos));
    // it won't compute some edge cases with strange trerrain but this is good enough (cause we refill edge extensions last)
    let visited: string[] = [];
    this.dfs(this.pos, visited, 0, Math.max(..._.map(poss, p => this.pos.getRangeTo(p))));
  }

  dfs(p: RoomPosition, visited: string[], depth: number, maxRange: number) {
    if (p.getRangeTo(this.pos) > maxRange || visited.includes(p.to_str))
      return;
    visited.push(p.to_str);
    _.forEach(p.getPositionsInRange(1), pp => {
      let ss = pp.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN)[0];
      if (ss && this.priorityMap[ss.id] === undefined)
        this.priorityMap[ss.id] = depth;
    });
    _.forEach(p.getPositionsInRange(1).sort((a, b) => b.getRangeTo(this) - a.getRangeTo(this)), pp => {
      if (pp.isFree(true) && pp.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_ROAD).length)
        this.dfs(pp, visited, depth + 1, maxRange);
    });
  }

  run() {
    // generate the queue and start spawning
    let energyAvailable = this.hive.room.energyAvailable;
    let orders = _.map(this.hive.spawOrders, o => o);

    for (let key = 0; key < orders.length && this.freeSpawns.length; ++key) {
      let order = orders.reduce((prev, curr) => {
        let ans = curr.priority - prev.priority;
        if (ans === 0)
          ans = curr.createTime - prev.createTime;
        if (ans === 0)
          ans = Math.random() - 0.5;
        return ans < 0 ? curr : prev;
      });
      let spawn = this.freeSpawns.pop()!;
      let setup;
      // 1 - army emergency priority 4 - army long run priority (mostly cause pvp is not automated yet)
      let moveMax = undefined;
      if (order.setup.moveMax === "best" && this.hive.cells.lab) {
        let master = Apiary.masters[order.master];
        if (master && master.boosts) {
          _.some(master.boosts.filter(b => b.type === "fatigue"), speedBoost => {
            if (speedBoost && !speedBoost.amount) {
              let info = this.hive.cells.lab!.getBoostInfo(speedBoost);
              if (!info)
                return false;
              let toBoost = 25;
              switch (info.res) {
                case "ZO":
                  toBoost = 17;
                  break;
                case "ZHO2":
                  toBoost = 13;
                  break;
                case "XZHO2":
                  toBoost = 10;
                  break;
              }
              if (info.amount >= toBoost) {
                moveMax = toBoost;
                return true;
              }
            }
            return false;
          });
        }
      }

      if (order.priority === 0 && (!this.hive.cells.storage || !this.hive.cells.storage.master.beesAmount)) {
        setup = order.setup.getBody(energyAvailable, moveMax);
        if (!setup.body.length)
          break;
      } else {
        setup = order.setup.getBody(this.hive.room.energyCapacityAvailable, moveMax);
        if (!setup.body.length) {
          this.freeSpawns.push(spawn);
          orders = orders.filter(o => order.ref !== o.ref);
          --key;
          continue;
        }
      }

      if (setup.cost > energyAvailable)
        break;

      let name = order.setup.name + " " + makeId(4);
      let memory: CreepMemory = {
        refMaster: order.master,
        born: Game.time,
        state: beeStates.idle,
      };

      let ans = spawn.spawnCreep(setup.body, name, { memory: memory });

      if (ans === OK) {
        if (Apiary.logger)
          Apiary.logger.newSpawn(name, spawn, setup.cost, order.master);
        energyAvailable -= setup.cost;
        delete this.hive.spawOrders[order.ref];
      }
      if (this.freeSpawns.length) {
        orders = orders.filter(o => order.ref !== o.ref);
        --key;
      }
    }
    if (this.hive.phase === 0) // renewing Boost creeps if they are better than we can spawn
      _.forEach(this.freeSpawns, s => {
        let creep = s.pos.findInRange(FIND_MY_CREEPS, 1).filter(c => c.name.includes(setupsNames.bootstrap)
          && c.body.length > Math.floor(this.hive.room.energyCapacityAvailable / 200) * 3)[0];
        if (creep && creep.ticksToLive && CREEP_LIFE_TIME - creep.ticksToLive >= 200)
          s.renewCreep(creep);
      });
    if (this.fastRef)
      this.fastRef.run();
  }
}
