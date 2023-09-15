import type { buildingCostsHive } from "abstract/hiveMemory";
import { SWARM_MASTER } from "orders/swarm-nums";
import { ZERO_COSTS_BUILDING_HIVE } from "static/constants";
import { hiveStates, prefix, roomStates } from "static/enums";

import { HIVE_WALLS_UP, WALLS_HEALTH } from "./_building-constants";
import { type BuildCell, type BuildProject } from "./buildCell";
import {
  addUpgradeBoost,
  checkBuildings,
  checkMinWallHealth,
} from "./hive-checkbuild";

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

export function wallMap(cell: BuildCell) {
  let targetHealth = cell.wallTargetHealth;
  if (cell.hive.isBattle) targetHealth += WALLS_HEALTH.battle;
  return {
    [STRUCTURE_WALL]: Math.min(targetHealth, WALL_HITS_MAX),
    [STRUCTURE_RAMPART]: Math.min(
      targetHealth,
      RAMPART_HITS_MAX[cell.hive.controller.level]
    ),
  };
}

/**
 * @param pos find closest target to this pos
 *
 * @param ignore ignore some type of task construction / repair
 */
export function getBuildTarget(
  this: BuildCell,
  pos: RoomPosition | { pos: RoomPosition },
  ignore?: "ignoreRepair" | "ignoreConst"
) {
  if (!this.structuresConst.length) {
    if (this.hive.state >= hiveStates.nukealert && this.forceCheck === "")
      this.forceCheck = "mainroom";
    return;
  }

  if (!(pos instanceof RoomPosition)) pos = pos.pos;
  let target: Structure | ConstructionSite | undefined;
  let projects: BuildProject[];

  projects = this.structuresConst;

  let getProj = () =>
    projects.length && (pos as RoomPosition).findClosest(projects);

  const wax = Game.flags[prefix.build + this.hiveName];
  if (wax && this.hive.state !== hiveStates.battle) {
    const projNear = projects.filter((p) => wax.pos.getRangeTo(p) <= 2);
    if (projNear.length) projects = projNear;
  }

  if (this.hive.state >= hiveStates.battle) {
    const inDanger = projects.filter((p) =>
      p.pos.findInRange(FIND_HOSTILE_CREEPS, 5)
    );
    ignore = "ignoreConst";
    if (inDanger.length) projects = inDanger;

    const enemy = Apiary.intel.getEnemyCreep(this);

    if (enemy) pos = enemy.pos;
    getProj = () =>
      projects.length &&
      projects.reduce((prev, curr) => {
        let ans = curr.pos.getRangeTo(pos) - prev.pos.getRangeTo(pos);
        if (ans === 0) ans = prev.energyCost - curr.energyCost;
        return ans < 0 ? curr : prev;
      });
  }

  if (ignore) projects = [...projects];

  // pull new build project
  let proj = getProj();
  while (proj && !target) {
    // if we can see room update target
    if (proj.pos.roomName in Game.rooms)
      // find target
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
    // if target in danger ignore it
    if (
      target &&
      target.pos.roomName !== this.hiveName &&
      this.hive.annexInDanger.includes(target.pos.roomName)
    )
      target = undefined;
    // remove taregt from orignial array if it doen't exist
    if (!target) {
      for (let k = 0; k < projects.length; ++k)
        if (
          projects[k].pos.x === proj.pos.x &&
          projects[k].pos.y === proj.pos.y
        ) {
          projects.splice(k, 1);
          break;
        }
      // get new target
      proj = getProj();
    }
  }

  return target;
}

export function updateStructures(this: BuildCell, forceAnnexCheck = false) {
  /** checking if i had some prev constructions and i need to recheck them */
  const reCheckAnnex =
    this.buildingCosts.annex.build + this.buildingCosts.annex.repair > 0 ||
    forceAnnexCheck;

  this.structuresConst = [];
  this.buildingCosts = _.cloneDeep(ZERO_COSTS_BUILDING_HIVE);
  let mode: "annex" | "hive" = "hive";
  const addCC = (ans: [BuildProject[], buildingCostsHive["hive"]]) => {
    this.structuresConst = this.structuresConst.concat(ans[0]);
    this.buildingCosts[mode].build += ans[1].build;
    this.buildingCosts[mode].repair += ans[1].repair;
  };
  let checkAnnex = () => {};
  // do check annex if not rc 1 and needed
  if (this.hive.controller.level >= 2 && reCheckAnnex) {
    const energyCap = this.hive.room.energyCapacityAvailable;
    const checkAnnexStruct = () => {
      _.forEach(this.hive.annexNames, (annexName) => {
        // dont check if can't see / dont build in annexes with enemies
        if (
          !(annexName in Game.rooms) ||
          this.hive.annexInDanger.includes(annexName)
        )
          return;

        // any info about annex (needed for to check if SK)
        const roomState = Apiary.intel.getRoomState(annexName);
        // dont go mining frontiers if not ready
        if (
          energyCap < 5500 &&
          (roomState === roomStates.SKfrontier ||
            roomState === roomStates.SKcentral)
        )
          return;

        // checks roads in annex
        const annexRoads = checkBuildings(
          this.hiveName,
          annexName,
          BUILDABLE_PRIORITY.roads,
          false
        );
        addCC(annexRoads);

        // check if big enough to start adding containers
        // based when i start sending acttual miners to locations
        // 800 possible option as milestone
        if (energyCap < 650) return;

        const annexMining = checkBuildings(
          this.hiveName,
          annexName,
          BUILDABLE_PRIORITY.mining,
          false
        );
        addCC(annexMining);

        // down the raod more complex options
        if (this.hive.resState.energy < 0) return;

        if (roomState === roomStates.SKfrontier) {
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
          const ref = prefix.containerBuilder + this.hiveName;
          if (
            mineralsContainer &&
            !annexRoads[0].filter((b) => b.type === "construction").length &&
            !Apiary.orders[ref]
          )
            this.hive.createSwarm(
              ref,
              mineralsContainer.pos,
              SWARM_MASTER.containerbuilder
            );
        }
        /* 
        // old code when i needed to swarm build hives
        // can be useful to flashstart colonies
        let annexHive = Apiary.hives[annexName]; 
          if (annexHive)
            addCC([annexHive.structuresConst, this.buildingCosts]); 
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
    allowConst: boolean = true,
    fearNukes = false
  ) =>
    _.forEach(toCheck, (type) => {
      // we do not check def before storage
      const ans = checkBuildings(
        this.hiveName,
        this.hiveName,
        BUILDABLE_PRIORITY[type],
        fearNukes,
        allowConst,
        type === "defense" ? wallMap(this) : undefined
      );
      addCC(ans);
    });

  // get first measure of walls health
  if (this.wallTargetHealth === WALLS_HEALTH.start)
    this.wallTargetHealth = nextWallTargetHealth(this);

  switch (this.hive.state) {
    case hiveStates.nukealert:
      checkAdd(["mining", "trade"]);
      checkAdd(["trade"], !this.structuresConst.length);
      checkAdd(["defense"], !this.structuresConst.length);
      checkAdd(["roads"]);
      checkAdd(["hightech"], !this.structuresConst.length, true);
      if (!this.structuresConst.length)
        addCC(this.hive.cells.defense.getNukeDefMap(true));
      else
        this.buildingCosts.hive.repair +=
          this.hive.cells.defense.getNukeDefMap(true)[1].repair;
      break;
    case hiveStates.nospawn:
      addCC(
        checkBuildings(this.hiveName, this.hiveName, [STRUCTURE_SPAWN], false)
      );
      break;
    case hiveStates.lowenergy:
      checkAdd(["essential", "mining", "defense", "roads"]);
      break;
    case hiveStates.battle: {
      const roomInfo = Apiary.intel.getInfo(this.hiveName, 25);
      if (roomInfo.enemies.length) {
        const defenseBuildings = checkBuildings(
          this.hiveName,
          this.hiveName,
          BUILDABLE_PRIORITY.defense,
          false,
          true,
          wallMap(this)
        );
        const enemyNearBy = defenseBuildings[0].filter(
          (p) =>
            roomInfo.enemies.filter((e) => p.pos.getRangeTo(e.object) <= 5)
              .length
        );
        if (enemyNearBy.length) addCC([enemyNearBy, defenseBuildings[1]]);
      }
      checkAdd(["defense"], !this.structuresConst.length, true);
      // no need to fall through cause if no enemies trule left next check will diff type
      break;
    }
    case hiveStates.economy: {
      checkAdd(["essential", "mining"]);
      checkAdd(["trade"], !this.structuresConst.length);
      if (this.structuresConst.length) {
        const defenses = checkBuildings(
          this.hiveName,
          this.hiveName,
          BUILDABLE_PRIORITY.defense,
          false
        );
        // if developed build minimal defense first
        if (defenses[0].length && this.hive.controller.level >= 6)
          this.structuresConst = [];
        addCC(defenses);
      }
      checkAdd(["defense"], !this.structuresConst.length, true);
      // hm add roads anyway?
      checkAdd(["roads"]);
      // adding container / storage to upgrade faster
      addCC(addUpgradeBoost(this.hiveName));

      if (this.hive.resState.energy > 0)
        checkAdd(["hightech"], !this.structuresConst.length, true);
      checkAnnex();
      // @todo up the limit on walls
      if (
        // always a little smth smth on annex repair roads / containers
        // but we ignore it
        this.structuresConst.length &&
        this.hive.phase < 2
      )
        return;
      const newWallsTarget = nextWallTargetHealth(this);
      // nothing changed
      if (this.wallTargetHealth === newWallsTarget) return;
      this.wallTargetHealth = newWallsTarget;
      checkAdd(["defense"], true, true);
      break;
    }
    default:
      // shouldn't happen, but just a failsafe
      checkAdd(["essential", "mining", "trade"]);
      checkAdd(["defense", "hightech"], true, true);
      checkAnnex();
  }
}

function nextWallTargetHealth(cell: BuildCell) {
  const minHealth = checkMinWallHealth(cell.hiveName);
  // downgrade walls if more then step
  if (cell.wallTargetHealth - minHealth >= WALLS_HEALTH.step)
    return Math.min(
      Math.ceil(minHealth / WALLS_HEALTH.step) * WALLS_HEALTH.step
    );
  // curr target for walls
  const currTarget = Math.max(cell.wallTargetHealth, minHealth);

  // check energy to decide if we need to one up the target
  for (const [wallTarget, energySurplus] of Object.entries(HIVE_WALLS_UP)) {
    // cap based on phase
    const wallHealth = Math.min(cell.maxWallHealth, +wallTarget);
    // only if < new Target
    if (currTarget >= wallHealth) continue;
    // only if > surplus
    if (cell.hive.resState.energy <= energySurplus) break;
    const newWallTargetHealth = Math.min(
      Math.ceil(minHealth / WALLS_HEALTH.step + 1) * WALLS_HEALTH.step,
      +wallHealth
    );
    console.log(
      `WALLS UP @ ${cell.print}: \t ${minHealth}/${currTarget} -> \t  ${minHealth}/${newWallTargetHealth}`
    );
    return newWallTargetHealth;
  }
  // will reach if no energy to up the walls or max by phase
  return currTarget < WALLS_HEALTH.step
    ? WALLS_HEALTH.step
    : Math.floor(currTarget / WALLS_HEALTH.step) * WALLS_HEALTH.step;
}
