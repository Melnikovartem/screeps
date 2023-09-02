import { buildingCostsHive } from "abstract/hiveMemory";
import type { BuildProject } from "hive/hive-declarations";
import { ZERO_COSTS_BUILDING_HIVE } from "static/constants";

import { BOOST_MINERAL } from "cells/stage1/laboratoryCell";
import { DefenseCell } from "./defenseCell";

// mini roomPlanner
export function getNukeDefMap(
  this: DefenseCell,
  oneAtATime = false
): [BuildProject[], buildingCostsHive["hive"]] {
  // i should think what to do if my defenses are under strike
  const prevState = this.nukeCoverReady;
  this.nukeCoverReady = true;
  if (!Object.keys(this.nukes).length)
    // || Game.flags[prefix.nukes + this.hiveName])
    return [[], { ...ZERO_COSTS_BUILDING_HIVE.hive }];
  const map: { [id: number]: { [id: number]: number } } = {};
  const minLandTime = _.min(this.nukes, (n) => n.timeToLand).timeToLand;
  _.forEach(this.nukes, (n) => {
    if (n.timeToLand > minLandTime + NUKE_LAND_TIME * 0.8 && !prevState) return; // can handle multiple rounds
    const pp = n.pos;
    const poss = pp.getPositionsInRange(2);
    _.forEach(poss, (p) => {
      if (!map[p.x]) map[p.x] = {};
      if (!map[p.x][p.y]) map[p.x][p.y] = 0;
      map[p.x][p.y] += NUKE_DAMAGE[2];
    });
    map[pp.x][pp.y] += NUKE_DAMAGE[0] - NUKE_DAMAGE[2];
  });

  const maxLandTime = _.max(this.nukes, (n) => n.timeToLand).timeToLand;
  const rampPadding =
    Math.ceil(maxLandTime / RAMPART_DECAY_TIME + 100) * RAMPART_DECAY_AMOUNT;

  const nukesProj: BuildProject[] = [];
  const extraCovers: string[] = [];
  const leaveOne = (ss: { [id: string]: Structure }) => {
    const underStrike = _.filter(
      ss,
      (s) => map[s.pos.x] && map[s.pos.x][s.pos.y]
    );
    if (!underStrike.length || underStrike.length !== Object.keys(ss).length)
      return;
    const cover = underStrike.reduce((prev, curr) =>
      map[curr.pos.x][curr.pos.y] < map[prev.pos.x][prev.pos.y] ? curr : prev
    );
    extraCovers.push(cover.pos.x + "_" + cover.pos.y);
  };

  let coef = 1;
  if (this.hive.cells) {
    const storage = this.hive.cells.storage;
    if (storage) {
      const checkMineralLvl = (lvl: 0 | 1 | 2) =>
        storage.getUsedCapacity(BOOST_MINERAL.build[lvl]) >= 1000;
      if (checkMineralLvl(2)) coef = 2;
      else if (checkMineralLvl(1)) coef = 1.8;
      else if (checkMineralLvl(0)) coef = 1.5;
    }

    leaveOne(this.hive.cells.spawn.spawns);
    if (this.hive.cells.lab) leaveOne(this.hive.cells.lab.laboratories);
  }

  const energyCost = { ...ZERO_COSTS_BUILDING_HIVE.hive };
  for (const x in map)
    for (const y in map[x]) {
      const pos = new RoomPosition(+x, +y, this.hiveName);
      const structures = pos.lookFor(LOOK_STRUCTURES);
      if (
        structures.filter((s) => {
          if (extraCovers.includes(s.pos.x + "_" + s.pos.y)) return true;
          const cost =
            CONSTRUCTION_COST[s.structureType as BuildableStructureConstant];
          const rampart = s.pos
            .lookFor(LOOK_STRUCTURES)
            .filter((isR) => isR.structureType === STRUCTURE_RAMPART)[0];
          let workNotDone = map[x][y];
          if (s instanceof StructureStorage)
            workNotDone -=
              Math.max(0, s.store.getUsedCapacity() - TERMINAL_CAPACITY) * 100;
          if (rampart) workNotDone -= rampart.hits;
          let ss = 1.5;
          if (s.structureType === STRUCTURE_SPAWN) ss = 4.9;
          else if (s.structureType === STRUCTURE_LAB) ss = 3;
          return cost * ss >= workNotDone / (100 * coef);
        }).length
      ) {
        const rampart = structures.filter(
          (s) => s.structureType === STRUCTURE_RAMPART
        )[0];
        let energy;
        const heal = map[x][y] + rampPadding;
        if (rampart) energy = Math.max(heal - rampart.hits, 0) / 100;
        else {
          energy = map[x][y] / 100;
          if (!pos.lookFor(LOOK_CONSTRUCTION_SITES).length)
            pos.createConstructionSite(STRUCTURE_RAMPART);
          nukesProj.push({
            pos,
            sType: STRUCTURE_RAMPART,
            targetHits: heal,
            energyCost: 1,
            type: "construction",
          });
          // ignore energy to build cause 1 ///
        }
        if (energy > 0) {
          energyCost.repair += Math.ceil(energy);
          nukesProj.push({
            pos,
            sType: STRUCTURE_RAMPART,
            targetHits: heal,
            energyCost: Math.ceil(energy),
            type: "repair",
          });
          this.nukeCoverReady = false;
        }
      }
    }

  if (oneAtATime && nukesProj.length) {
    const findType = (
      prev: { pos: RoomPosition },
      curr: { pos: RoomPosition },
      type: StructureConstant
    ) =>
      prev.pos.lookFor(LOOK_STRUCTURES).filter((s) => s.structureType === type)
        .length -
      curr.pos.lookFor(LOOK_STRUCTURES).filter((s) => s.structureType === type)
        .length;
    const theOne = nukesProj.reduce((prev, curr) => {
      let ans = findType(prev, curr, STRUCTURE_STORAGE);
      if (ans === 0) ans = findType(prev, curr, STRUCTURE_TERMINAL);
      if (ans === 0) ans = findType(prev, curr, STRUCTURE_SPAWN);
      if (ans === 0)
        ans = map[curr.pos.x][curr.pos.y] - map[prev.pos.x][prev.pos.y];
      return ans < 0 ? curr : prev;
    });
    return [[theOne], energyCost];
  }
  return [nukesProj, energyCost];
}

export function updateNukes(this: DefenseCell) {
  this.nukes = {};
  this.timeToLand = Infinity;
  _.forEach(this.hive.room.find(FIND_NUKES), (n) => {
    this.nukes[n.id] = n;
    if (this.timeToLand > n.timeToLand) this.timeToLand = n.timeToLand;
  });
  if (!Object.keys(this.nukes).length) this.timeToLand = Infinity;
  else this.getNukeDefMap();
}
