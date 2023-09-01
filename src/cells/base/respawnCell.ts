import { Bee } from "bees/bee";
import type { Hive } from "hive/hive";
import type { SpawnOrder } from "hive/hive-declarations";
import { profile } from "profiler/decorator";
import { ApiaryReturnCode } from "static/constants";
import { beeStates, prefix, setupsNames } from "static/enums";
import { makeId } from "static/utils";

import { Cell } from "../_Cell";
import { FastRefillCell } from "../stage1/fastRefill";

@profile
export class RespawnCell extends Cell {
  public spawns: { [id: string]: StructureSpawn } = {};
  public freeSpawns: StructureSpawn[] = [];
  public extensions: { [id: string]: StructureExtension } = {};
  public master: undefined;

  public fastRef: FastRefillCell | undefined;

  public priorityMap: { [id: string]: number } = {};

  private recycleSpawnId: Id<StructureSpawn> | "" = "";
  private recycledPrev = false;

  /** Dictionary of spawn orders */
  public spawnQue: SpawnOrder[] = [];

  public constructor(hive: Hive) {
    super(hive, prefix.respawnCell);
  }

  private spawnEval(spawn: StructureSpawn) {
    if (!spawn.effects) return 0;
    const powerup = spawn.effects.filter(
      (e) => e.effect === PWR_OPERATE_SPAWN
    )[0] as PowerEffect;
    if (powerup) return -powerup.level;
    return 0;
  }

  private spawnDisrupted(spawn: StructureSpawn) {
    return (
      spawn.effects &&
      spawn.effects.filter((e) => e.effect === PWR_DISRUPT_SPAWN).length
    );
  }

  private get recycleSpawn() {
    return this.spawns[this.recycleSpawnId] || Object.values(this.spawns)[0];
  }

  public update() {
    super.update(["extensions", "spawns"]);

    if (this.recycledPrev) {
      // here we only deal with energy
      if (this.hive.cells.storage)
        this.hive.cells.storage.requestToStorage(
          this.recycleSpawn.pos
            .findInRange(FIND_TOMBSTONES, 1)
            .filter((tomb) => tomb.store.getUsedCapacity(RESOURCE_ENERGY)),
          6,
          RESOURCE_ENERGY
        );
      else if (this.hive.cells.dev) this.hive.cells.dev.shouldRecalc = true;
      this.recycledPrev = false;
    }

    const fastRefPos =
      !this.fastRef &&
      this.hive.phase >= 1 &&
      this.hive.cells.storage &&
      FastRefillCell.poss(this.hiveName);
    if (fastRefPos) {
      const link = fastRefPos
        .lookFor(LOOK_STRUCTURES)
        .filter((s) => s.structureType === STRUCTURE_LINK)[0] as
        | StructureLink
        | undefined;
      if (link) this.fastRef = new FastRefillCell(this, link);
    }

    // find free spawners
    this.freeSpawns = _.filter(
      this.spawns,
      (structure) => !structure.spawning && !this.spawnDisrupted(structure)
    );
    this.freeSpawns.sort((a, b) => this.spawnEval(b) - this.spawnEval(a));
    this.hive.stateChange("nospawn", !Object.keys(this.spawns).length);

    const storageCell = this.hive.cells.storage;
    if (storageCell)
      storageCell.requestFromStorage(this.getTargets(), 0, RESOURCE_ENERGY);
    if (this.fastRef) this.fastRef.update();
  }

  public getTargets() {
    if (this.fastRef) this.fastRef.refillTargets = [];
    const targets = _.filter(
      (
        Object.values(this.spawns) as (StructureSpawn | StructureExtension)[]
      ).concat(Object.values(this.extensions)),
      (s) => this.checkTarget(s)
    );
    targets.sort(
      (a, b) =>
        (this.priorityMap[a.id] || Infinity) -
        (this.priorityMap[b.id] || Infinity)
    );
    return targets;
  }

  private checkTarget(s: StructureSpawn | StructureExtension) {
    if (
      s.store.getFreeCapacity(RESOURCE_ENERGY) <= 0 ||
      (this.hive.cells.storage && this.hive.cells.storage.requests[s.id])
    )
      return false;
    if (this.fastRef && this.fastRef.pos.getRangeTo(s) <= 2)
      for (const m of this.fastRef.masters) {
        if (m.pos.getRangeTo(s) <= 1 && m.beesAmount) {
          this.fastRef.refillTargets.push(s);
          return false;
        }
      }
    return true;
  }

  public bakePriority() {
    this.recycleSpawnId = _.reduce(this.spawns, (prev: StructureSpawn, curr) =>
      this.hive.pos.getRangeTo(prev) < this.hive.pos.getRangeTo(curr)
        ? prev
        : curr
    )?.id;
    const poss: RoomPosition[] = _.map(this.spawns, (s) => s.pos).concat(
      _.map(this.extensions, (s) => s.pos)
    );
    // it won't compute some edge cases with strange trerrain but this is good enough (cause we refill edge extensions last)
    const visited: string[] = [];
    this.dfs(
      this.pos,
      visited,
      0,
      Math.max(..._.map(poss, (p) => this.pos.getRangeTo(p)))
    );
  }

  private dfs(
    p: RoomPosition,
    visited: string[],
    depth: number,
    maxRange: number
  ) {
    if (p.getRangeTo(this.pos) > maxRange || visited.includes(p.to_str)) return;
    visited.push(p.to_str);
    _.forEach(p.getPositionsInRange(1), (pp) => {
      const ss = pp
        .lookFor(LOOK_STRUCTURES)
        .filter(
          (s) =>
            s.structureType === STRUCTURE_EXTENSION ||
            s.structureType === STRUCTURE_SPAWN
        )[0];
      if (ss && this.priorityMap[ss.id] === undefined)
        this.priorityMap[ss.id] = depth;
    });
    _.forEach(
      p
        .getPositionsInRange(1)
        .sort((a, b) => b.getRangeTo(this) - a.getRangeTo(this)),
      (pp) => {
        if (
          pp.isFree(true) &&
          pp
            .lookFor(LOOK_STRUCTURES)
            .filter((s) => s.structureType === STRUCTURE_ROAD).length
        )
          this.dfs(pp, visited, depth + 1, maxRange);
      }
    );
  }

  public run() {
    // generate the queue and start spawning
    let energyAvailable = this.hive.room.energyAvailable;
    // used to be dict to arr. now just silly, but need to be able to splice

    // only problem is if something important to hive gets filled up with other orders
    this.spawnQue.sort((a, b) => {
      // lower priority first
      let priorityDiff = a.priority - b.priority;
      // time of addition to the que
      // 1% chance to chose old ones instead of new ones
      // so that in case of overfill
      // we can also reach some important bees like upgrade
      // activate if find any problems with this system
      // maybe think about checking of how many bees per master is spawned this tick
      if (priorityDiff === 0)
        // || Math.random() < 0.01
        priorityDiff = a.createTime - b.createTime;
      // random ))
      if (priorityDiff === 0) priorityDiff = Math.random() - 0.5;
      return priorityDiff;
    });

    for (let i = 0; i < this.spawnQue.length && this.freeSpawns.length; ++i) {
      const spawn = this.freeSpawns.pop()!;
      let setup;
      // 1 - army emergency priority 4 - army long run priority (mostly cause pvp is not automated yet)
      let moveMax;
      const order = this.spawnQue[i];

      // boosted movement check
      if (order.setup.moveMax === "best" && this.hive.cells.lab) {
        const master = Apiary.masters[order.master];
        if (master && master.boosts) {
          _.some(
            master.boosts.filter((b) => b.type === "fatigue"),
            (speedBoost) => {
              if (speedBoost && !speedBoost.amount) {
                const info = this.hive.cells.lab!.getBoostInfo(speedBoost);
                if (!info) return false;
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
                // enough to boost bee to max
                if (info.amount >= toBoost) {
                  moveMax = toBoost;
                  return true;
                }
              }
              return false;
            }
          );
        }
      }

      if (
        order.priority === 0 &&
        (!this.hive.cells.storage || !this.hive.cells.storage.master.beesAmount)
      ) {
        setup = order.setup.getBody(energyAvailable, moveMax);
        if (!setup.body.length) break;
      } else {
        setup = order.setup.getBody(
          this.hive.room.energyCapacityAvailable,
          moveMax
        );
        if (!setup.body.length) {
          this.freeSpawns.push(spawn);
          continue;
        }
      }

      if (setup.cost > energyAvailable) break;

      const name = order.setup.name + " " + makeId(4);
      const memory: CreepMemory = {
        refMaster: order.master,
        born: Game.time,
        state: beeStates.idle,
      };

      const ans = spawn.spawnCreep(setup.body, name, { memory });

      if (ans === OK) {
        Apiary.logger.newSpawn(name, spawn, setup.cost, order.master);
        energyAvailable -= setup.cost;
        this.spawnQue.splice(i, 1);
        --i;
      }
    }

    if (this.hive.phase === 0)
      // renewing Boost creeps if they are better than we can spawn
      _.forEach(this.freeSpawns, (s) => {
        const creep = s.pos
          .findInRange(FIND_MY_CREEPS, 1)
          .filter(
            (c) =>
              c.name.includes(setupsNames.bootstrap) &&
              c.body.length >
                Math.floor(this.hive.room.energyCapacityAvailable / 200) * 3
          )[0];
        if (
          creep &&
          creep.ticksToLive &&
          CREEP_LIFE_TIME - creep.ticksToLive >= 200
        )
          s.renewCreep(creep);
      });
    if (this.fastRef) this.fastRef.run();
  }

  /** move bee to lab and unboost it
   *
   * OK - bee should be dead
   *
   * ERR_NOT_FOUND - no spawn found
   *
   * ERR_NOT_IN_RANGE - going to spawn
   *
   * or unboostCreep return code
   */
  public recycleBee(bee: Bee, opt?: TravelToOptions): ApiaryReturnCode {
    // get a spawn
    const spawn = this.recycleSpawn;
    if (!spawn) return ERR_NOT_FOUND;
    if (!spawn.pos.isNearTo(bee)) {
      // need just to get close
      opt = { range: 1, ...opt };
      bee.goTo(spawn, opt);
      return ERR_NOT_IN_RANGE;
    }
    // recycle the creep
    // tbh kinda not sure if worth at all
    const ans = spawn.recycleCreep(bee.creep);
    // if (ans === OK)
    // @todo Apiary.logger
    // not sure how to log this cause resources could as well just decay
    // 0.9 to account for failed pickups
    if (ans === OK)
      Apiary.logger?.addResourceStat(
        this.hiveName,
        "recycle",
        ((_.sum(
          bee.body,
          (bp) =>
            Math.min(BODYPART_COST[bp.type], 125) + // CREEP_PART_MAX_ENERGY was undefined in .ts
            (bp.boost ? LAB_BOOST_ENERGY : 0)
        ) *
          bee.ticksToLive) /
          CREEP_LIFE_TIME) *
          0.9,
        RESOURCE_ENERGY
      );
    return ans;
  }
}
