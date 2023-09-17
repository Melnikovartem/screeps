import type { Bee } from "bees/bee";
import type { Hive } from "hive/hive";
import type { SpawnOrder } from "hive/hive-declarations";
import { profile } from "profiler/decorator";
import type { ApiaryReturnCode } from "static/constants";
import { beeStates, prefix, setupsNames } from "static/enums";
import { makeId } from "static/utils";

import { Cell } from "../_Cell";
import { FastRefillCell } from "./fastRefill";

@profile
export class RespawnCell extends Cell {
  // #region Properties (8)

  private recycleSpawnId: Id<StructureSpawn> | "" = "";
  private recycledPrev = false;

  public extensions: { [id: string]: StructureExtension } = {};
  public fastRef: FastRefillCell | undefined;
  public freeSpawns: StructureSpawn[] = [];
  public priorityMap: { [id: string]: number } = {};
  /** Dictionary of spawn orders */
  public spawnQue: SpawnOrder[] = [];
  public spawns: { [id: string]: StructureSpawn } = {};

  // #endregion Properties (8)

  // #region Constructors (1)

  public constructor(hive: Hive) {
    super(hive, prefix.respawnCell);
  }

  // #endregion Constructors (1)

  // #region Public Accessors (2)

  public get recordedCapacity() {
    const spawnCapacity =
      Object.keys(this.spawns).length * SPAWN_ENERGY_CAPACITY;
    const extensionsCapacity =
      Object.keys(this.extensions).length *
      EXTENSION_ENERGY_CAPACITY[this.hive.controller.level];
    return spawnCapacity + extensionsCapacity;
  }

  public get recycleSpawn(): StructureSpawn | undefined {
    return this.spawns[this.recycleSpawnId] || Object.values(this.spawns)[0];
  }

  // #endregion Public Accessors (2)

  // #region Public Methods (5)

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
      Apiary.logger?.reportResourceUsage(
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
        if (master && master.boosts.length) {
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

      if (order.priority === 0 && !this.hive.cells.storage.master.beesAmount) {
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

  public update() {
    this.updateObjects(["extensions", "spawns"]);

    if (this.recycledPrev && this.recycleSpawn) {
      // here we only deal with energy
      this.hive.cells.storage.requestToStorage(
        this.recycleSpawn.pos
          .findInRange(FIND_TOMBSTONES, 1)
          .filter((tomb) => tomb.store.getUsedCapacity(RESOURCE_ENERGY)),
        6,
        RESOURCE_ENERGY
      );
      this.recycledPrev = false;
    }

    const fastRefPos = !this.fastRef && FastRefillCell.poss(this.hiveName);
    if (fastRefPos) this.fastRef = new FastRefillCell(this);

    // find free spawners
    this.freeSpawns = _.filter(
      this.spawns,
      (structure) => !structure.spawning && !this.spawnDisrupted(structure)
    );
    this.freeSpawns.sort((a, b) => this.spawnEval(b) - this.spawnEval(a));
    this.hive.stateChange("nospawn", !Object.keys(this.spawns).length);

    this.hive.cells.storage.requestFromStorage(
      this.getTargets(),
      0,
      RESOURCE_ENERGY
    );

    if (this.fastRef) this.fastRef.update();
  }

  // #endregion Public Methods (5)

  // #region Private Methods (4)

  private checkTarget(s: StructureSpawn | StructureExtension) {
    if (
      s.store.getFreeCapacity(RESOURCE_ENERGY) <= 0 ||
      this.hive.cells.storage.requests[s.id]
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
          pp.isFree() &&
          pp
            .lookFor(LOOK_STRUCTURES)
            .filter((s) => s.structureType === STRUCTURE_ROAD).length
        )
          this.dfs(pp, visited, depth + 1, maxRange);
      }
    );
  }

  private spawnDisrupted(spawn: StructureSpawn) {
    return (
      spawn.effects &&
      spawn.effects.filter((e) => e.effect === PWR_DISRUPT_SPAWN).length
    );
  }

  private spawnEval(spawn: StructureSpawn) {
    if (!spawn.effects) return 0;
    const powerup = spawn.effects.filter(
      (e) => e.effect === PWR_OPERATE_SPAWN
    )[0] as PowerEffect;
    if (powerup) return -powerup.level;
    return 0;
  }

  // #endregion Private Methods (4)
}
