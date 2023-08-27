import { HIVE_ENERGY } from "cells/stage1/storageCell";
import { hiveStates, prefix, roomStates } from "static/enums";

import type { BuildProject, Hive } from "./hive";
import { checkBuildings, checkMinWallHealth } from "./hive-checkbuild";

/**
 * Only the first thing in que will be build/repaired
 * */
const BUILDABLE_PRIORITY = {
  essential: [STRUCTURE_TOWER, STRUCTURE_SPAWN, STRUCTURE_EXTENSION],
  roads: [STRUCTURE_ROAD],
  mining: [STRUCTURE_LINK, STRUCTURE_CONTAINER, STRUCTURE_EXTRACTOR],
  trade: [STRUCTURE_STORAGE, STRUCTURE_TERMINAL],
  defense: [STRUCTURE_WALL, STRUCTURE_RAMPART],
  hightech: [
    STRUCTURE_LAB,
    STRUCTURE_OBSERVER,
    STRUCTURE_POWER_SPAWN,
    STRUCTURE_FACTORY,
    STRUCTURE_NUKER,
  ],
};

export const HIVE_WALLS_UP = {
  [100_000]: 0,
  [10_000_000]: HIVE_ENERGY * 0.5,
  [25_000_000]: HIVE_ENERGY,
  [50_000_000]: HIVE_ENERGY * 1.5,
  // [WALL_HITS_MAX]: HIVE_ENERGY * 2, // big project
};
// KEEP BUFFING WALLS IF BATTLE
const WALLS_BATTLE_BUFFER = 10_000_000;
/** AVG case boosted ~100k energy
 *
 * worst case unboosted 1m energy */
const WALLS_STEP = 1_000_000;

export function wallMap(hive: Hive) {
  let targetHealth = hive.wallTargetHealth;
  if (hive.state === hiveStates.battle) targetHealth += WALLS_BATTLE_BUFFER;
  return {
    [STRUCTURE_WALL]: Math.min(targetHealth, WALL_HITS_MAX),
    [STRUCTURE_RAMPART]: Math.min(
      targetHealth,
      RAMPART_HITS_MAX[hive.controller.level]
    ),
  };
}

export function getBuildTarget(
  this: Hive,
  pos: RoomPosition | { pos: RoomPosition },
  ignore?: "ignoreRepair" | "ignoreConst"
) {
  if (!this.structuresConst.length) {
    if (this.shouldRecalc < 1 && this.state >= hiveStates.nukealert)
      this.shouldRecalc = 1;
    return;
  }

  if (!(pos instanceof RoomPosition)) pos = pos.pos;
  let target: Structure | ConstructionSite | undefined;
  let projects: BuildProject[];

  if (ignore) projects = [...this.structuresConst];
  else projects = this.structuresConst;

  let getProj = () =>
    projects.length && (pos as RoomPosition).findClosest(projects);

  const wax = Game.flags[prefix.build + this.roomName];
  if (wax && this.state !== hiveStates.battle) {
    const projNear = projects.filter((p) => wax.pos.getRangeTo(p) <= 2);
    if (projNear.length) projects = projNear;
  }

  if (this.state >= hiveStates.battle) {
    const inDanger = projects.filter((p) =>
      p.pos.findInRange(FIND_HOSTILE_CREEPS, 3)
    );
    ignore = "ignoreConst";
    if (inDanger.length) projects = inDanger;
    else projects = [...projects];

    const enemy = Apiary.intel.getEnemyCreep(this);
    if (enemy) pos = enemy.pos; // dont work well with several points
    getProj = () =>
      projects.length &&
      projects.reduce((prev, curr) => {
        let ans = curr.pos.getRangeTo(pos) - prev.pos.getRangeTo(pos);
        if (ans === 0) ans = prev.energyCost - curr.energyCost;
        return ans < 0 ? curr : prev;
      });
  }

  let proj = getProj();
  while (proj && !target) {
    if (proj.pos.roomName in Game.rooms)
      switch (proj.type) {
        case "construction":
          if (ignore !== "ignoreConst")
            target = proj.pos.lookFor(LOOK_CONSTRUCTION_SITES)[0];
          break;
        case "repair":
          if (ignore !== "ignoreRepair")
            target = proj.pos
              .lookFor(LOOK_STRUCTURES)
              .filter(
                (s) =>
                  s.structureType === (proj as BuildProject).sType &&
                  s.hits < (proj as BuildProject).targetHits &&
                  s.hits < s.hitsMax
              )[0];
          break;
      }
    if (
      target &&
      target.pos.roomName !== this.roomName &&
      this.annexInDanger.includes(target.pos.roomName)
    )
      target = undefined;
    if (!target) {
      for (let k = 0; k < projects.length; ++k)
        if (
          projects[k].pos.x === proj.pos.x &&
          projects[k].pos.y === proj.pos.y
        ) {
          projects.splice(k, 1);
          break;
        }
      proj = getProj();
    }
  }

  return target;
}

export function updateStructures(this: Hive) {
  /** checking if i had some prev constructions and i need to recheck them */
  const reCheckAnnex = this.sumCost.annex > 0;

  this.structuresConst = [];
  this.sumCost = { annex: 0, hive: 0 };
  let mode: "annex" | "hive" = "hive";
  const addCC = (ans: [BuildProject[], number]) => {
    this.structuresConst = this.structuresConst.concat(ans[0]);
    this.sumCost[mode] += ans[1];
  };
  let checkAnnex = () => {};
  // do check annex if not rc 1 and needed
  if (this.controller.level >= 2 && (reCheckAnnex || this.shouldRecalc > 2)) {
    const checkAnnexStruct = () => {
      _.forEach(this.annexNames, (annexName) => {
        // dont check if can't see / dont build in annexes with enemies
        if (
          !(annexName in Game.rooms) ||
          this.annexInDanger.includes(annexName)
        )
          return;

        // any info about annex (needed for to check if SK)
        const roomInfo = Apiary.intel.getInfo(annexName, Infinity);
        // dont go mining frontiers if not ready
        if (
          this.room.energyCapacityAvailable < 5500 &&
          (roomInfo.roomState === roomStates.SKfrontier ||
            roomInfo.roomState === roomStates.SKcentral)
        )
          return;

        // checks roads in annex
        const annexRoads = checkBuildings(
          annexName,
          BUILDABLE_PRIORITY.roads,
          false
        );
        addCC(annexRoads);

        // check if big enough to start adding containers
        // based when i start sending acttual miners to locations
        // 800 possible option as milestone
        if (this.room.energyCapacityAvailable < 650) return;

        const annexMining = checkBuildings(
          annexName,
          BUILDABLE_PRIORITY.mining,
          false
        );
        addCC(annexMining);

        // down the raod more complex options
        if (this.resState.energy < 0) return;

        if (roomInfo.roomState === roomStates.SKfrontier) {
          // help bootstrap containers for mineral mining in SK as fucker Keepers are annoying
          const mineralsContainer = annexMining[0].filter(
            (b) =>
              b.sType === STRUCTURE_CONTAINER &&
              b.type === "construction" &&
              b.pos.findInRange(FIND_MINERALS, 1).length
          )[0];
          // old code for also helping to start buidling energy containers
          // if (!mineralsContainer) mineralsContainer = annexMining[0].filter(b => b.sType === STRUCTURE_CONTAINER && b.type === "construction")[0];

          // @todo remove code?
          // normal builder code could fix the problem
          // not more then one active order of booting per hive
          if (
            mineralsContainer &&
            roomInfo.safePlace &&
            !annexRoads[0].filter((b) => b.type === "construction").length &&
            !Game.flags["containerBuilder_" + this.roomName]
          )
            mineralsContainer.pos.createFlag(
              "containerBuilder_" + this.roomName,
              COLOR_BLUE,
              COLOR_YELLOW
            );
        }
        /* 
        // old code when i needed to swarm build hives
        // can be useful to flashstart colonies
        let annexHive = Apiary.hives[annexName]; 
          if (annexHive)
            addCC([annexHive.structuresConst, annexHive.sumCost]); 
        */
      });
    };
    checkAnnex = () => {
      mode = "annex";
      checkAnnexStruct();
      mode = "hive";
    };
  }

  const checkAdd = (
    toCheck: (keyof typeof BUILDABLE_PRIORITY)[],
    fearNukes = false
  ) =>
    _.forEach(toCheck, (type) =>
      checkBuildings(
        this.roomName,
        BUILDABLE_PRIORITY[type],
        fearNukes,
        type === "defense" ? wallMap(this) : undefined
      )
    );

  switch (this.state) {
    case hiveStates.nukealert:
      checkAdd(["mining", "trade"]);
      if (!this.structuresConst.length) checkAdd(["trade"]);
      if (!this.structuresConst.length) checkAdd(["defense"]);
      checkAdd(["roads"]);
      if (!this.structuresConst.length) checkAdd(["hightech"], true);
      if (!this.structuresConst.length)
        addCC(this.cells.defense.getNukeDefMap(true));
      else this.sumCost.hive += this.cells.defense.getNukeDefMap(true)[1];
      break;
    case hiveStates.nospawn:
      addCC(checkBuildings(this.roomName, [STRUCTURE_SPAWN], false));
      break;
    case hiveStates.lowenergy:
      checkAdd(["essential", "mining", "defense", "roads"]);
      break;
    case hiveStates.battle: {
      const roomInfo = Apiary.intel.getInfo(this.roomName, 25);
      if (roomInfo.enemies.length) {
        const defenseBuildings = checkBuildings(
          this.roomName,
          BUILDABLE_PRIORITY.defense,
          false,
          wallMap(this)
        );
        const enemyNearBy = defenseBuildings[0].filter(
          (p) =>
            roomInfo.enemies.filter((e) => p.pos.getRangeTo(e.object) <= 5)
              .length
        );
        if (enemyNearBy.length) addCC([enemyNearBy, defenseBuildings[1]]);
      }
      if (!this.structuresConst.length) checkAdd(["defense"], true);
      // no need to fall through cause if no enemies trule left next check will diff type
      break;
    }
    case hiveStates.economy:
      checkAdd(["essential", "mining"]);
      if (!this.structuresConst.length) checkAdd(["trade"]);
      if (!this.structuresConst.length) checkAdd(["defense"], true);
      else {
        const defenses = checkBuildings(
          this.roomName,
          BUILDABLE_PRIORITY.defense,
          false
        );
        // if developed build minimal defense first
        if (defenses[0].length && this.controller.level >= 6)
          this.structuresConst = [];
        addCC(defenses);
      }
      // hm add roads anyway?
      checkAdd(["roads"]);

      if (!this.structuresConst.length && this.resState.energy > 0)
        checkAdd(["hightech"], true);
      checkAnnex();
      // @todo up the limit on walls
      if (!this.structuresConst.length) {
        this.wallTargetHealth = nextWallTargetHealth(this);
      }
      break;
    default:
      // shouldn't happen, but just a failsafe
      checkAdd(["essential", "mining", "trade"]);
      checkAdd(["defense", "hightech"], true);
      checkAnnex();
  }
}

function nextWallTargetHealth(hive: Hive) {
  const minHealth = checkMinWallHealth(hive.roomName);
  if (hive.wallTargetHealth - minHealth >= WALLS_STEP)
    return Math.ceil(minHealth / WALLS_STEP) * WALLS_STEP;
  const currTarget = Math.max(hive.wallTargetHealth, minHealth);

  for (const [wallHealth, energySurplus] of Object.entries(HIVE_WALLS_UP)) {
    if (currTarget > +wallHealth) continue;
    if (hive.resState.energy < energySurplus) break;
    return Math.min(
      Math.ceil(minHealth / WALLS_STEP + 1) * WALLS_STEP,
      +wallHealth
    );
  }
  return currTarget;
}