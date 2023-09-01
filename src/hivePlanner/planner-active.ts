import { Hive } from "hive/hive";
import { getCase } from "static/utils";

import type { CellCache, RoomPlanner } from "./planner";

function anchorDist(
  anchor: RoomPosition,
  p: Pos,
  roomName: string = anchor.roomName,
  pathfind = false
) {
  if (pathfind)
    return anchor.getTimeForPath(new RoomPosition(p.x, p.y, roomName));
  return anchor.getRangeApprox(new RoomPosition(p.x, p.y, roomName));
}
// oh no i need to def
const ADD_RAMPART: (BuildableStructureConstant | undefined | null)[] = []; // STRUCTURE_TOWER, STRUCTURE_SPAWN, STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_LAB, STRUCTURE_FACTORY, STRUCTURE_NUKER, STRUCTURE_POWER_SPAWN]; // STRUCTURE_LINK

export function toActive(
  this: RoomPlanner,
  anchor: RoomPosition,
  roomName: string = anchor.roomName,
  ignore: BuildableStructureConstant[] = []
) {
  this.initPlanning(roomName, anchor);
  this.activePlanning[roomName].exits.push(anchor);
  for (const t in Memory.cache.roomPlanner[roomName]) {
    const sType = t as BuildableStructureConstant;
    if (ignore.indexOf(sType) !== -1) continue;
    const poss = Memory.cache.roomPlanner[roomName][sType]!.pos;
    for (const posToAdd of poss)
      this.addToPlan(posToAdd, roomName, sType, true);
    if (!poss.length) delete Memory.cache.roomPlanner[roomName][sType];
  }

  const hiveName = anchor.roomName;
  if (Memory.cache.hives[hiveName]) {
    for (const cellType in Memory.cache.hives[hiveName].cells) {
      const cellCache = Memory.cache.hives[hiveName].cells[cellType];
      const poss = cellCache?.poss as
        | {
            x: number;
            y: number;
            roomName?: string;
          }
        | undefined;
      if (
        poss &&
        (poss.roomName === roomName ||
          (!poss.roomName && roomName === hiveName))
      )
        this.activePlanning[roomName].cellsCache[cellType] = { poss };
    }
  }
}

export function resetPlanner(
  this: RoomPlanner,
  roomName: string,
  anchor: RoomPosition
) {
  Memory.cache.roomPlanner[roomName] = {};
  this.currentToActive(roomName, anchor);
  this.saveActive(roomName);
  delete this.activePlanning[roomName];
}

export function currentToActive(
  this: RoomPlanner,
  roomName: string,
  anchor: RoomPosition
) {
  this.initPlanning(roomName, anchor);
  _.forEach(
    (
      Game.rooms[roomName].find(FIND_STRUCTURES) as (
        | Structure
        | ConstructionSite
      )[]
    ).concat(
      Game.rooms[roomName].find(FIND_CONSTRUCTION_SITES).filter((c) => c.my)
    ),
    (s) => {
      if (!(s.structureType in CONTROLLER_STRUCTURES)) return;
      if (getCase(s).amount === 0) return;
      if (s.pos.enteranceToRoom) return;
      this.addToPlan(
        s.pos,
        s.pos.roomName,
        s.structureType as BuildableStructureConstant
      );
    }
  );
}

export function saveActive(this: RoomPlanner, roomName: string) {
  const active = this.activePlanning[roomName];
  if (!active) return;
  Memory.cache.roomPlanner[roomName] = {};
  const myRoom =
    Game.rooms[roomName] &&
    Game.rooms[roomName].controller &&
    Game.rooms[roomName].controller!.my;
  for (const x in active.plan)
    for (const y in active.plan[+x]) {
      if (active.plan[+x][+y].s)
        addToCache({ x: +x, y: +y }, roomName, active.plan[+x][+y].s!);
      else if (active.plan[+x][+y].s === null && myRoom) {
        const s = new RoomPosition(+x, +y, roomName).lookFor(
          LOOK_STRUCTURES
        )[0];
        if (
          s &&
          s.structureType !== STRUCTURE_RAMPART &&
          s.structureType !== STRUCTURE_ROAD
        )
          s.destroy();
      }

      if (active.plan[+x][+y].r || ADD_RAMPART.includes(active.plan[+x][+y].s))
        addToCache({ x: +x, y: +y }, roomName, STRUCTURE_RAMPART);
    }

  const anchor = this.activePlanning[roomName].anchor;
  for (const t in Memory.cache.roomPlanner[roomName]) {
    const sType = t as BuildableStructureConstant;
    const poss = Memory.cache.roomPlanner[roomName][sType]!.pos;
    const contr = Game.rooms[roomName] && Game.rooms[roomName].controller;
    const terrain = Game.map.getRoomTerrain(roomName);
    const posWeighted = poss.map((pos) => {
      return { pos, dist: anchorDist(anchor, pos, roomName, true) };
    });
    posWeighted.sort((a, b) => {
      let ans = a.dist - b.dist;
      if (sType === STRUCTURE_LINK && contr)
        if (
          contr.pos.getRangeTo(new RoomPosition(a.pos.x, a.pos.y, roomName)) <=
          3
        )
          ans = -1;
        else if (
          contr.pos.getRangeTo(new RoomPosition(b.pos.x, b.pos.y, roomName)) <=
          3
        )
          ans = 1;
      if (ans === 0)
        ans = terrain.get(a.pos.x, a.pos.y) - terrain.get(b.pos.x, b.pos.y);
      return ans; //* (sType === STRUCTURE_RAMPART || sType === STRUCTURE_WALL ? -1 : 1);
    });
    Memory.cache.roomPlanner[roomName][sType]!.pos = posWeighted.map(
      (p) => p.pos
    );
  }

  const cellsCache = this.activePlanning[anchor.roomName].cellsCache;
  if (Object.keys(cellsCache).length) {
    if (!Memory.cache.hives[anchor.roomName]) Hive.initMemory(anchor.roomName);
    const mem = Memory.cache.hives[anchor.roomName];
    for (const cellType in cellsCache) {
      const cellCache = cellsCache[cellType];
      if (!mem.cells[cellType]) mem.cells[cellType] = {};
      for (const key in cellCache)
        mem.cells[cellType][key] = cellCache[key as keyof CellCache]; // same format as before whit/whithout roomName
    }
  }
}

export function addToCache(
  pos: Pos,
  roomName: string,
  sType: BuildableStructureConstant
) {
  if (!Memory.cache.roomPlanner[roomName][sType])
    Memory.cache.roomPlanner[roomName][sType] = { pos: [] };
  Memory.cache.roomPlanner[roomName][sType]!.pos.push({ x: pos.x, y: pos.y });
}
