import type { buildingCostsHive } from "abstract/hiveMemory";
import { PLANNER_STAMP_STOP } from "antBrain/hivePlanner/planner-utils";
import type { Hive } from "hive/hive";
import { ZERO_COSTS_BUILDING_HIVE } from "static/constants";
import { prefix } from "static/enums";
import { getCase, makeId } from "static/utils";

import { BUFFER_ZONE, WALLS_HEALTH } from "./_building-constants";
import { type BuildProject } from "./buildCell";

// absolute max to add
const CONSTRUCTIONS_PER_FUNCTION = 30;
export type checkBuildingsReturn = [BuildProject[], buildingCostsHive["hive"]];
export function checkBuildings(
  hiveName: string,
  roomName: string,
  queToCheck: BuildableStructureConstant[],
  fearNukes: boolean,
  allowConstBase: boolean = true,
  specials: { [key in StructureConstant]?: number } = {}
): checkBuildingsReturn {
  const hivePlan = Memory.longterm.roomPlanner[hiveName];

  if (!(roomName in Game.rooms) || !hivePlan || !hivePlan.rooms[roomName])
    return [[], { ...ZERO_COSTS_BUILDING_HIVE.hive }];

  const contr = Game.rooms[roomName].controller;
  let controller: StructureController | { level: number } | undefined = contr;
  if (!controller) controller = { level: 0 };

  const buildProjectList: BuildProject[] = [];
  const energyCost = { ...ZERO_COSTS_BUILDING_HIVE.hive };
  let constructions = 0;
  let blocked = 0;

  for (const sType of queToCheck) {
    const mem = hivePlan.rooms[roomName][sType];
    if (!mem) continue;

    const cc = getCase({
      structureType: sType,
      pos: { roomName },
      hitsMax: 0,
    });

    const toadd: RoomPosition[] = [];
    const toaddBlank: RoomPosition[] = [];
    const buildBlank: BuildProject[] = [];
    let placed = 0;
    let allowConst = allowConstBase;

    for (const positionToPut of mem) {
      if (positionToPut === PLANNER_STAMP_STOP) {
        // added block of constructions no need to add more
        if (constructions || toadd.length || blocked) allowConst = false;
        continue;
      }
      // no need to check more
      if (placed + constructions + blocked >= cc.amount) break;

      const pos = new RoomPosition(
        positionToPut[0],
        positionToPut[1],
        roomName
      );

      const ans = checkStructureBuild(
        pos,
        sType,
        allowConst ? buildProjectList : buildBlank,
        allowConst && !constructions ? toadd : toaddBlank,
        fearNukes,
        specials
      );
      if (ans === "structure") ++placed;
      else if (ans === "construction") ++constructions;
      else if (ans === "blocked") ++blocked;
    }

    for (const bProject of buildProjectList)
      if (bProject.type === "repair") energyCost.repair += bProject.energyCost;
      else energyCost.build += bProject.energyCost;
    for (const bProject of buildBlank)
      if (bProject.type === "repair") energyCost.repair += bProject.energyCost;
      else energyCost.build += bProject.energyCost;
    const constructionCost = addConstruction(
      sType,
      buildProjectList,
      toadd,
      specials,
      placed,
      constructions,
      cc.amount
    );
    energyCost.build += constructionCost.build;
    energyCost.repair += constructionCost.repair;
    const balnkCost = addConstruction(
      sType,
      [],
      toaddBlank,
      specials,
      placed,
      constructions,
      cc.amount,
      true
    );
    energyCost.build += balnkCost.build;
    energyCost.repair += balnkCost.repair;
  }
  return [buildProjectList, energyCost];
}

function isDefenseStructure(sType: BuildableStructureConstant) {
  return sType === STRUCTURE_RAMPART || sType === STRUCTURE_WALL;
}

function addConstruction(
  sType: BuildableStructureConstant,
  buildProjectList: BuildProject[],
  toadd: RoomPosition[],
  specials: { [key in StructureConstant]?: number } = {},
  placed = 0,
  constructions = 0,
  maxamount = Infinity,
  blank = false
): buildingCostsHive["hive"] {
  const isDefense = isDefenseStructure(sType);
  const energyCost = {
    build: 0,
    repair: 0,
  };
  for (let i = 0; i < toadd.length && placed < maxamount; ++i) {
    let createAns: ScreepsReturnCode = ERR_NOT_FOUND;
    if (constructions >= CONSTRUCTIONS_PER_FUNCTION) blank = true;

    // check if we here are only adding power
    if (!blank)
      if (sType === STRUCTURE_SPAWN)
        // @todo more original name for spawn
        createAns = toadd[i].createConstructionSite(
          sType,
          toadd[i].roomName.toLowerCase() + "_" + makeId(4)
        );
      else createAns = toadd[i].createConstructionSite(sType);

    if (createAns === OK) {
      buildProjectList.push({
        pos: toadd[i],
        sType,
        targetHits: 0,
        energyCost: CONSTRUCTION_COST[sType],
        type: "construction",
      });
      ++constructions;
      ++placed;
    }
    // add even if no construction cost so we can plan bases at all volume of jobs
    energyCost.build += CONSTRUCTION_COST[sType];

    if (isDefense) {
      let heal = WALLS_HEALTH.step;
      if (sType in specials) heal = specials[sType]!;

      // need only 1 energy so also add building them u
      if (createAns === OK)
        buildProjectList.push({
          pos: toadd[i],
          sType,
          targetHits: heal,
          energyCost: Math.ceil(heal / 100),
          type: "repair",
        });
      // also add energy Cost
      energyCost.repair += Math.ceil(heal / 100);
    }
  }
  return energyCost;
}

function checkStructureBuild(
  pos: RoomPosition,
  sType: BuildableStructureConstant,
  buildProjectList: BuildProject[],
  toadd: RoomPosition[],
  fearNukes = true,
  specials: { [key in StructureConstant]?: number } = {}
) {
  const structure = _.filter(
    pos.lookFor(LOOK_STRUCTURES),
    (s) => s.structureType === sType
  )[0] as Structure<BuildableStructureConstant> | undefined;
  const hive = Apiary.hives[pos.roomName] as Hive | undefined;
  const nukeAlert =
    fearNukes && hive && Object.keys(hive.cells.defense.nukes).length > 0;
  let type: "structure" | "construction" | "blocked" | "none" = "none";
  const isDefense = isDefenseStructure(sType);

  if (structure) {
    type = "structure";
    let heal = getCase(structure).heal;
    if (sType in specials) heal = specials[sType]!;
    const calcBuffer = () => {
      if (!Object.keys(BUFFER_ZONE).includes(sType)) return 0;
      const key = sType as keyof typeof BUFFER_ZONE;
      // coef more decay for swamp / walls of roads;
      const coef = sType === STRUCTURE_ROAD ? structure.hitsMax / ROAD_HITS : 1;
      const builders = hive && hive.cells.build.master.activeBees.length;
      return Math.min(
        heal * 0.5,
        (builders ? BUFFER_ZONE[key].aliveBees : BUFFER_ZONE[key].noBees) * coef
      );
    };
    heal -= calcBuffer();

    if (nukeAlert && isDefense) {
      const nukeDmg = _.sum(
        pos.findInRange(FIND_NUKES, 2),
        (n) =>
          NUKE_DAMAGE[2] + (n.pos.getRangeTo(pos) === 0 ? NUKE_DAMAGE[0] : 0)
      );
      if (nukeDmg > 0 && nukeDmg < 2 * heal) heal = nukeDmg + heal;
    }
    if (structure.hits < heal)
      buildProjectList.push({
        pos,
        sType,
        targetHits: heal,
        energyCost: Math.ceil((heal - structure.hits) / 100),
        type: "repair",
      });
  } else {
    // check for own construction sites?
    const constructionSite = _.filter(
      pos.lookFor(LOOK_CONSTRUCTION_SITES),
      (s) => s.structureType === sType
    )[0] as ConstructionSite<BuildableStructureConstant> | undefined;

    if (constructionSite) {
      type = "construction";
      buildProjectList.push({
        pos,
        sType,
        targetHits: 0,
        energyCost: constructionSite.progressTotal - constructionSite.progress,
        type: "construction",
      });
      if (isDefense) {
        let heal = getCase(constructionSite).heal;
        if (sType in specials) heal = specials[sType]!;
        buildProjectList.push({
          pos,
          sType,
          targetHits: heal,
          energyCost: Math.ceil(heal / 100),
          type: "repair",
        });
      }
    } else {
      // anything on this pos
      const place = _.filter(
        pos.lookFor(LOOK_STRUCTURES),
        (s) =>
          s.structureType !== STRUCTURE_RAMPART || !(s as StructureRampart).my
      )[0] as Structure | undefined;

      // we do not need to add more cause already have enough
      const onlySpawn =
        sType === STRUCTURE_SPAWN &&
        hive &&
        Object.keys(hive.cells.spawn.spawns).length === 1 &&
        getCase({
          structureType: STRUCTURE_SPAWN,
          pos: { roomName: pos.roomName },
          hitsMax: 0,
        }).amount === 1;
      if (
        (!place || sType === STRUCTURE_RAMPART) &&
        (!nukeAlert || !pos.findInRange(FIND_NUKES, 2).length) &&
        !onlySpawn // do not add spawns if we have only one
      ) {
        // need to add construction
        type = "blocked";
        toadd.push(pos);
      } else if (hive && place) {
        // our only spawn there
        if (
          place.structureType === STRUCTURE_SPAWN &&
          Object.keys(hive.cells.spawn.spawns).length === 1
        ) {
          // will add but later, skip for now
          type = "structure";
        } else {
          // blocked by other one
          type = "blocked";
          place.destroy();
        }
      } else {
        // blocked by nuke / or just one spawn / or blocked in neutral room
        // skip for now
        type = "structure";
      }
    }
  }

  return type;
}

export function checkMinWallHealth(hiveName: string) {
  const mem = Memory.longterm.roomPlanner[hiveName];
  if (!mem || !mem.rooms[hiveName]) return 0;
  let minHealth = Infinity;

  const check = (sType: STRUCTURE_RAMPART | STRUCTURE_WALL) => {
    const positions = mem.rooms[hiveName][sType];
    if (!positions) return;
    _.forEach(positions, (pos) => {
      if (pos === PLANNER_STAMP_STOP) return;
      const struct = new RoomPosition(pos[0], pos[1], hiveName)
        .lookFor(LOOK_STRUCTURES)
        .filter((s) => s.structureType === sType)[0];
      if (struct && struct.hits < minHealth) minHealth = struct.hits;
    });
  };

  check(STRUCTURE_RAMPART);
  check(STRUCTURE_WALL);

  return minHealth === Infinity ? 0 : minHealth;
}

export function addUpgradeBoost(hiveName: string): checkBuildingsReturn {
  const hive = Apiary.hives[hiveName] as Hive | undefined;
  const buildProjectList: BuildProject[] = [];
  const toadd: RoomPosition[] = [];
  const energyCost = { ...ZERO_COSTS_BUILDING_HIVE.hive };
  // dont need to manually add container for upgrading

  // first 2 links are for storage / fastRef
  if (
    !hive ||
    CONTROLLER_STRUCTURES[STRUCTURE_LINK][hive.controller.level] > 2 ||
    hive.controller.level <= 1
  )
    return [buildProjectList, energyCost];
  const upgPoss =
    Memory.longterm.roomPlanner[hiveName]?.posCell[prefix.upgradeCell];
  if (!upgPoss) return [buildProjectList, energyCost];
  const pos = new RoomPosition(upgPoss[0], upgPoss[1], hiveName);
  checkStructureBuild(pos, STRUCTURE_CONTAINER, buildProjectList, toadd);

  for (const bProject of buildProjectList)
    if (bProject.type === "repair") energyCost.repair += bProject.energyCost;
    else energyCost.build += bProject.energyCost;
  const constructionCost = addConstruction(
    STRUCTURE_CONTAINER,
    buildProjectList,
    toadd
  );
  energyCost.build += constructionCost.build;
  energyCost.repair += constructionCost.repair;
  return [buildProjectList, energyCost];
}
