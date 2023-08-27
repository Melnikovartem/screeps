import { HIVE_ENERGY } from "cells/stage1/storageCell";
import { hiveStates, roomStates } from "static/enums";

import type { BuildProject, Hive } from "./hive";

// Define structure group types
type StructureGroups =
  | "essential"
  | "roads"
  | "mining"
  | "defense"
  | "hightech"
  | "trade";

// Define a mapping of structure groups to buildable structure constants
const BUILDABLE_PRIORITY: {
  [key in StructureGroups]: BuildableStructureConstant[];
} = {
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
  [40_000_000]: HIVE_ENERGY,
  [100_000_000]: HIVE_ENERGY * 1.5,
  // [WALL_HITS_MAX]: HIVE_ENERGY * 2, // big project
};
// KEEP BUFFING WALLS IF BATTLE
const WALLS_BATTLE_BUFFER = 10_000_000;
/** AVG case boosted ~100k energy
 *
 * worst case unboosted 1m energy */
const WALLS_STEP = 1_000_000;
export const WALLS_START = 10_000;
const REPAIR_STEP = WALLS_STEP * 0.5;

function nextWallTargetHealth(hive: Hive) {
  for (const [wallHealth, energySurplus] of Object.entries(HIVE_WALLS_UP)) {
    if (hive.wallTargetHealth > +wallHealth) continue;
    if (hive.resState.energy < energySurplus) break;
    return Math.min(hive.wallTargetHealth + WALLS_STEP, +wallHealth);
  }
  return hive.wallTargetHealth;
}

export function wallMap(hive: Hive, battle = false) {
  let targetHealth = hive.wallTargetHealth;
  if (battle) targetHealth += WALLS_BATTLE_BUFFER;
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
    // this.wallTargetHealth < this.nextWallTargetHealth
    if (this.shouldRecalc < 2 && this.state >= hiveStates.nukealert)
      this.shouldRecalc = 2;
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
  const reCheck = this.sumCost > 0;
  const nukeAlert = !!Object.keys(this.cells.defense.nukes).length;
  this.structuresConst = [];
  this.sumCost = 0;
  const addCC = (ans: [BuildProject[], number]) => {
    this.structuresConst = this.structuresConst.concat(ans[0]);
    this.sumCost += ans[1];
  };
  let checkAnnex = () => {
    _.forEach(this.annexNames, (annexName) => {
      if (!(annexName in Game.rooms) || this.annexInDanger.includes(annexName))
        return;
      const roomInfo = Apiary.intel.getInfo(annexName, Infinity);
      if (
        this.room.energyCapacityAvailable < 5500 &&
        (roomInfo.roomState === roomStates.SKfrontier ||
          roomInfo.roomState === roomStates.SKcentral)
      )
        return;
      const annexRoads = Apiary.planner.checkBuildings(
        annexName,
        BUILDABLE_PRIORITY.roads,
        false
      );
      addCC(annexRoads);
      if (this.room.energyCapacityAvailable >= 650) {
        // 800
        const annexMining = Apiary.planner.checkBuildings(
          annexName,
          BUILDABLE_PRIORITY.mining,
          false
        );
        addCC(annexMining);
        if (
          roomInfo.roomState === roomStates.SKfrontier &&
          this.resState[RESOURCE_ENERGY] >= 0
        ) {
          const mineralsContainer = annexMining[0].filter(
            (b) =>
              b.sType === STRUCTURE_CONTAINER &&
              b.type === "construction" &&
              b.pos.findInRange(FIND_MINERALS, 1).length
          )[0];
          // if (!mineralsContainer) mineralsContainer = annexMining[0].filter(b => b.sType === STRUCTURE_CONTAINER && b.type === "construction")[0];
          if (
            mineralsContainer &&
            roomInfo.safePlace &&
            !annexRoads[0].filter((b) => b.type === "construction").length &&
            !Game.flags["containerBuilder_" + this.roomName]
          )
            // one per hive at a time
            mineralsContainer.pos.createFlag(
              "containerBuilder_" + this.roomName,
              COLOR_BLUE,
              COLOR_YELLOW
            );
        }
        /* let annexHive = Apiary.hives[annexName]; old code when i needed to swarm build hives
        if (annexHive)
          addCC([annexHive.structuresConst, annexHive.sumCost]); */
      }
    });
  };

  if (
    (!reCheck &&
      this.shouldRecalc <= 1 &&
      Math.round(Game.time / 100) % 8 !== 0) ||
    this.controller.level < 2
  )
    checkAnnex = () => {};

  switch (this.state) {
    case hiveStates.nukealert:
      addCC(
        Apiary.planner.checkBuildings(
          this.roomName,
          BUILDABLE_PRIORITY.essential,
          false
        )
      );
      addCC(
        Apiary.planner.checkBuildings(
          this.roomName,
          BUILDABLE_PRIORITY.mining,
          false
        )
      );
      if (!this.structuresConst.length)
        addCC(
          Apiary.planner.checkBuildings(
            this.roomName,
            BUILDABLE_PRIORITY.defense,
            false,
            wallMap(this),
            0.55
          )
        );
      addCC(
        Apiary.planner.checkBuildings(
          this.roomName,
          BUILDABLE_PRIORITY.roads,
          false
        )
      );
      if (!this.structuresConst.length)
        addCC(
          Apiary.planner.checkBuildings(
            this.roomName,
            BUILDABLE_PRIORITY.trade,
            true
          )
        );
      if (!this.structuresConst.length)
        addCC(
          Apiary.planner.checkBuildings(
            this.roomName,
            BUILDABLE_PRIORITY.hightech,
            true
          )
        );
      if (!this.structuresConst.length)
        addCC(this.cells.defense.getNukeDefMap(true));
      else {
        this.sumCost +=
          this.cells.defense.getNukeDefMap(true)[1] +
          Apiary.planner.checkBuildings(
            this.roomName,
            BUILDABLE_PRIORITY.defense,
            true,
            wallMap(this),
            0.99
          )[1];
      }
      // checkAnnex();
      break;
    case hiveStates.nospawn:
      addCC(
        Apiary.planner.checkBuildings(
          this.roomName,
          [STRUCTURE_SPAWN],
          nukeAlert
        )
      );
      break;
    case hiveStates.lowenergy:
      addCC(
        Apiary.planner.checkBuildings(
          this.roomName,
          BUILDABLE_PRIORITY.essential,
          false
        )
      );
      addCC(
        Apiary.planner.checkBuildings(
          this.roomName,
          BUILDABLE_PRIORITY.mining,
          false
        )
      );
      addCC(
        Apiary.planner.checkBuildings(
          this.roomName,
          BUILDABLE_PRIORITY.defense,
          nukeAlert
        )
      );
      addCC(
        Apiary.planner.checkBuildings(
          this.roomName,
          BUILDABLE_PRIORITY.roads,
          false
        )
      );
      checkAnnex();
      break;
    case hiveStates.battle: {
      const roomInfo = Apiary.intel.getInfo(this.roomName);
      if (roomInfo.enemies.length) {
        const proj = Apiary.planner.checkBuildings(
          this.roomName,
          BUILDABLE_PRIORITY.defense,
          false,
          wallMap(this, true),
          0.99
        );
        addCC([
          proj[0].filter(
            (p) =>
              roomInfo.enemies.filter((e) => p.pos.getRangeTo(e.object) <= 5)
                .length
          ),
          proj[1],
        ]);
      }
      if (!this.structuresConst.length)
        addCC(
          Apiary.planner.checkBuildings(
            this.roomName,
            BUILDABLE_PRIORITY.defense,
            nukeAlert,
            wallMap(this),
            0.99
          )
        );
      break;
    }
    case hiveStates.economy:
      addCC(
        Apiary.planner.checkBuildings(
          this.roomName,
          BUILDABLE_PRIORITY.essential,
          false
        )
      );
      addCC(
        Apiary.planner.checkBuildings(
          this.roomName,
          BUILDABLE_PRIORITY.mining,
          false
        )
      );
      if (!this.structuresConst.length)
        addCC(
          Apiary.planner.checkBuildings(
            this.roomName,
            BUILDABLE_PRIORITY.trade,
            nukeAlert
          )
        );
      if (!this.structuresConst.length)
        addCC(
          Apiary.planner.checkBuildings(
            this.roomName,
            BUILDABLE_PRIORITY.defense,
            nukeAlert,
            wallMap(this),
            this.wallsHealth > 1000000 ? 0.9 : undefined
          )
        );
      else {
        const defenses = Apiary.planner.checkBuildings(
          this.roomName,
          BUILDABLE_PRIORITY.defense,
          false
        );
        if (defenses[0].length && this.controller.level >= 6)
          this.structuresConst = [];
        addCC(defenses);
      }
      addCC(
        Apiary.planner.checkBuildings(
          this.roomName,
          BUILDABLE_PRIORITY.roads,
          nukeAlert
        )
      );
      if (
        !this.structuresConst.length &&
        this.cells.storage &&
        this.cells.storage.getUsedCapacity(RESOURCE_ENERGY) >=
          this.resTarget[RESOURCE_ENERGY] / 2
      )
        addCC(
          Apiary.planner.checkBuildings(
            this.roomName,
            BUILDABLE_PRIORITY.hightech,
            nukeAlert
          )
        );
      checkAnnex();
      if (
        !this.structuresConst.length &&
        this.builder &&
        this.builder.activeBees
      )
        addCC(
          Apiary.planner.checkBuildings(
            this.roomName,
            BUILDABLE_PRIORITY.defense,
            nukeAlert,
            wallMap(this),
            0.99
          )
        );
      if (
        !this.structuresConst.length &&
        this.wallsHealth < this.wallsHealthMax &&
        ((this.cells.storage && this.resState[RESOURCE_ENERGY] > 0) ||
          (this.wallsHealth < this.wallsHealthMax &&
            this.controller.level >= 4))
      ) {
        this.wallsHealth = Math.min(
          this.wallsHealth + 4 * Memory.settings.wallsHealth * 0.0005,
          this.wallsHealthMax
        );
        addCC(
          Apiary.planner.checkBuildings(
            this.roomName,
            BUILDABLE_PRIORITY.defense,
            nukeAlert,
            this.wallMap,
            0.99
          )
        );
      }
      break;
    default:
      // never for now
      addCC(
        Apiary.planner.checkBuildings(
          this.roomName,
          BUILDABLE_PRIORITY.essential,
          false
        )
      );
      addCC(
        Apiary.planner.checkBuildings(
          this.roomName,
          BUILDABLE_PRIORITY.mining,
          false
        )
      );
      addCC(
        Apiary.planner.checkBuildings(
          this.roomName,
          BUILDABLE_PRIORITY.defense,
          nukeAlert,
          this.wallMap
        )
      );
      addCC(
        Apiary.planner.checkBuildings(
          this.roomName,
          BUILDABLE_PRIORITY.roads,
          false
        )
      );
      addCC(
        Apiary.planner.checkBuildings(
          this.roomName,
          BUILDABLE_PRIORITY.hightech,
          nukeAlert
        )
      );
  }
}
