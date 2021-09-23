import { makeId } from "./utils";

import { profile } from "../profiler/decorator";

import type { PossiblePositions, BuildProject } from "../Hive";

export type Pos = { x: number, y: number };
export type RoomSetup = { [key in BuildableStructureConstant]?: { pos: { x: number, y: number }[] } };

type Module = { setup: RoomSetup, freeSpaces: Pos[], exits: Pos[], poss: PossiblePositions };

const BASE_HORIZONTAL: Module = { poss: { lab: { x: 20, y: 26 } }, exits: [{ x: 20, y: 24 }, { x: 20, y: 26 }], freeSpaces: [{ x: 19, y: 23 }, { x: 19, y: 24 }, { x: 19, y: 25 }, { x: 19, y: 26 }, { x: 19, y: 27 }, { x: 25, y: 24 }, { x: 26, y: 24 }, { x: 26, y: 25 }], setup: { road: { pos: [{ x: 25, y: 25 }, { x: 26, y: 26 }, { x: 24, y: 24 }, { x: 23, y: 24 }, { x: 24, y: 23 }, { x: 26, y: 27 }, { x: 27, y: 26 }, { x: 28, y: 25 }, { x: 25, y: 22 }, { x: 27, y: 24 }, { x: 26, y: 23 }, { x: 25, y: 28 }, { x: 22, y: 25 }, { x: 23, y: 26 }, { x: 24, y: 27 }, { x: 21, y: 25 }, { x: 20, y: 24 }, { x: 20, y: 26 }] }, lab: { pos: [{ x: 21, y: 24 }, { x: 22, y: 24 }, { x: 23, y: 25 }, { x: 22, y: 26 }, { x: 21, y: 26 }, { x: 20, y: 25 }, { x: 20, y: 23 }, { x: 21, y: 23 }, { x: 20, y: 27 }, { x: 21, y: 27 }] }, storage: { pos: [{ x: 25, y: 26 }] }, link: { pos: [{ x: 24, y: 25 }] }, terminal: { pos: [{ x: 24, y: 26 }] } } };

const BASE_VERTICAL: Module = { poss: { lab: { x: 20, y: 26 } }, exits: [{ x: 20, y: 26 }, { x: 20, y: 24 }], freeSpaces: [{ x: 19, y: 23 }, { x: 19, y: 24 }, { x: 19, y: 25 }, { x: 19, y: 26 }, { x: 19, y: 27 }, { x: 23, y: 28 }, { x: 23, y: 22 }, { x: 22, y: 27 }, { x: 22, y: 23 }, { x: 25, y: 24 }, { x: 26, y: 24 }, { x: 26, y: 25 }, { x: 20, y: 28 }, { x: 21, y: 28 }, { x: 20, y: 30 }, { x: 21, y: 30 }, { x: 22, y: 29 }, { x: 21, y: 22 }, { x: 20, y: 22 }, { x: 20, y: 20 }, { x: 21, y: 20 }, { x: 22, y: 21 }, { x: 20, y: 21 }, { x: 20, y: 29 }], setup: { road: { pos: [{ x: 25, y: 25 }, { x: 26, y: 26 }, { x: 24, y: 24 }, { x: 23, y: 24 }, { x: 24, y: 23 }, { x: 26, y: 27 }, { x: 27, y: 26 }, { x: 28, y: 25 }, { x: 25, y: 22 }, { x: 27, y: 24 }, { x: 26, y: 23 }, { x: 25, y: 28 }, { x: 22, y: 25 }, { x: 23, y: 26 }, { x: 24, y: 27 }, { x: 21, y: 25 }, { x: 20, y: 24 }, { x: 20, y: 26 }, { x: 23, y: 23 }, { x: 22, y: 22 }, { x: 21, y: 21 }, { x: 23, y: 27 }, { x: 22, y: 28 }, { x: 21, y: 29 }] }, lab: { pos: [{ x: 21, y: 24 }, { x: 22, y: 24 }, { x: 23, y: 25 }, { x: 22, y: 26 }, { x: 21, y: 26 }, { x: 20, y: 25 }, { x: 20, y: 23 }, { x: 21, y: 23 }, { x: 20, y: 27 }, { x: 21, y: 27 }] }, storage: { pos: [{ x: 25, y: 26 }] }, link: { pos: [{ x: 24, y: 25 }] }, terminal: { pos: [{ x: 24, y: 26 }] } } };

const EXTRA_VERTICAL: Module = { poss: { queen1: { x: 23, y: 25 }, queen2: { x: 27, y: 25 } }, exits: [{ x: 23, y: 22 }, { x: 25, y: 22 }, { x: 27, y: 22 }], freeSpaces: [{ x: 22, y: 21 }, { x: 23, y: 21 }, { x: 24, y: 21 }, { x: 25, y: 21 }, { x: 26, y: 21 }, { x: 27, y: 21 }, { x: 28, y: 21 }, { x: 23, y: 26 }, { x: 24, y: 25 }, { x: 26, y: 25 }, { x: 27, y: 26 }, { x: 24, y: 24 }, { x: 26, y: 24 }, { x: 27, y: 24 }, { x: 27, y: 23 }, { x: 28, y: 23 }, { x: 28, y: 26 }, { x: 28, y: 25 }, { x: 29, y: 25 }, { x: 29, y: 24 }, { x: 30, y: 24 }, { x: 30, y: 23 }, { x: 30, y: 22 }, { x: 29, y: 22 }, { x: 28, y: 22 }, { x: 23, y: 24 }, { x: 23, y: 23 }, { x: 22, y: 23 }, { x: 22, y: 22 }, { x: 21, y: 22 }, { x: 20, y: 22 }, { x: 20, y: 23 }, { x: 21, y: 24 }, { x: 21, y: 25 }, { x: 22, y: 25 }, { x: 22, y: 26 }, { x: 20, y: 24 }], setup: { road: { pos: [{ x: 25, y: 24 }, { x: 23, y: 25 }, { x: 22, y: 24 }, { x: 21, y: 23 }, { x: 27, y: 25 }, { x: 26, y: 23 }, { x: 24, y: 23 }, { x: 25, y: 22 }, { x: 27, y: 22 }, { x: 23, y: 22 }, { x: 28, y: 24 }, { x: 29, y: 23 }] }, lab: { pos: [] }, spawn: { pos: [{ x: 25, y: 26 }] }, tower: { pos: [{ x: 25, y: 23 }, { x: 24, y: 22 }, { x: 26, y: 22 }] } } };

const EXTRA_HORIZONTAL: Module = { poss: {}, exits: [{ x: 20, y: 23 }, { x: 20, y: 27 }], freeSpaces: [{ x: 19, y: 24 }, { x: 19, y: 23 }, { x: 19, y: 22 }, { x: 19, y: 26 }, { x: 19, y: 27 }, { x: 19, y: 28 }, { x: 21, y: 25 }, { x: 22, y: 24 }, { x: 22, y: 26 }, { x: 21, y: 27 }, { x: 20, y: 28 }, { x: 20, y: 22 }, { x: 21, y: 23 }], setup: { road: { pos: [{ x: 20, y: 23 }, { x: 22, y: 25 }, { x: 21, y: 26 }, { x: 20, y: 27 }, { x: 21, y: 24 }] }, lab: { pos: [] }, storage: { pos: [] }, link: { pos: [] }, terminal: { pos: [] }, spawn: { pos: [{ x: 23, y: 25 }] }, tower: { pos: [{ x: 20, y: 24 }, { x: 20, y: 26 }, { x: 20, y: 25 }] } } };

const WALLS: Module = { poss: {}, exits: [], freeSpaces: [], setup: { constructedWall: { pos: [{ x: 17, y: 20 }, { x: 17, y: 22 }, { x: 17, y: 23 }, { x: 17, y: 24 }, { x: 17, y: 25 }, { x: 17, y: 21 }, { x: 17, y: 27 }, { x: 17, y: 28 }, { x: 17, y: 29 }, { x: 17, y: 30 }, { x: 17, y: 31 }, { x: 17, y: 26 }, { x: 17, y: 32 }, { x: 17, y: 33 }, { x: 19, y: 33 }, { x: 20, y: 33 }, { x: 21, y: 33 }, { x: 22, y: 33 }, { x: 23, y: 33 }, { x: 24, y: 33 }, { x: 25, y: 33 }, { x: 26, y: 33 }, { x: 27, y: 33 }, { x: 28, y: 33 }, { x: 29, y: 33 }, { x: 30, y: 33 }, { x: 31, y: 33 }, { x: 32, y: 33 }, { x: 33, y: 33 }, { x: 18, y: 33 }, { x: 17, y: 18 }, { x: 17, y: 17 }, { x: 18, y: 17 }, { x: 19, y: 17 }, { x: 20, y: 17 }, { x: 21, y: 17 }, { x: 22, y: 17 }, { x: 23, y: 17 }, { x: 27, y: 17 }, { x: 28, y: 17 }, { x: 29, y: 17 }, { x: 30, y: 17 }, { x: 31, y: 17 }, { x: 32, y: 17 }, { x: 33, y: 17 }, { x: 17, y: 19 }, { x: 34, y: 33 }, { x: 34, y: 31 }, { x: 34, y: 30 }, { x: 34, y: 29 }, { x: 34, y: 28 }, { x: 34, y: 27 }, { x: 34, y: 26 }, { x: 34, y: 25 }, { x: 34, y: 24 }, { x: 34, y: 23 }, { x: 34, y: 22 }, { x: 34, y: 21 }, { x: 34, y: 20 }, { x: 34, y: 19 }, { x: 34, y: 18 }, { x: 34, y: 17 }, { x: 34, y: 32 }, { x: 18, y: 19 }, { x: 18, y: 20 }, { x: 18, y: 21 }, { x: 18, y: 22 }, { x: 18, y: 23 }, { x: 18, y: 24 }, { x: 18, y: 25 }, { x: 18, y: 26 }, { x: 18, y: 27 }, { x: 18, y: 28 }, { x: 18, y: 29 }, { x: 18, y: 30 }, { x: 18, y: 31 }, { x: 18, y: 32 }, { x: 33, y: 32 }, { x: 33, y: 31 }, { x: 33, y: 30 }, { x: 33, y: 29 }, { x: 33, y: 28 }, { x: 33, y: 27 }, { x: 33, y: 26 }, { x: 33, y: 25 }, { x: 33, y: 24 }, { x: 33, y: 23 }, { x: 33, y: 22 }, { x: 33, y: 21 }, { x: 33, y: 20 }, { x: 33, y: 19 }, { x: 33, y: 18 }, { x: 18, y: 18 }, { x: 27, y: 18 }, { x: 32, y: 18 }, { x: 31, y: 18 }, { x: 30, y: 18 }, { x: 29, y: 18 }, { x: 28, y: 18 }, { x: 26, y: 18 }, { x: 25, y: 18 }, { x: 24, y: 18 }, { x: 23, y: 18 }, { x: 22, y: 18 }, { x: 21, y: 18 }, { x: 20, y: 18 }, { x: 19, y: 18 }, { x: 27, y: 32 }, { x: 30, y: 32 }, { x: 32, y: 32 }, { x: 31, y: 32 }, { x: 29, y: 32 }, { x: 28, y: 32 }, { x: 26, y: 32 }, { x: 25, y: 32 }, { x: 24, y: 32 }, { x: 23, y: 32 }, { x: 22, y: 32 }, { x: 21, y: 32 }, { x: 20, y: 32 }, { x: 19, y: 32 }, { x: 25, y: 17 }, { x: 26, y: 17 }, { x: 24, y: 17 }] } } };

const WALL_HEALTH = {
  small: 200000,
  big: 1000000,
}

const SPECIAL_STRUCTURE: { [key in StructureConstant]?: { [level: number]: { amount: number, heal: number } } } = {
  [STRUCTURE_ROAD]: { 0: { amount: 2500, heal: ROAD_HITS / 2 }, 1: { amount: 0, heal: ROAD_HITS / 2 }, 2: { amount: 0, heal: ROAD_HITS / 2 }, 3: { amount: 2500, heal: ROAD_HITS / 2 }, 4: { amount: 2500, heal: ROAD_HITS / 2 }, 5: { amount: 2500, heal: ROAD_HITS / 2 }, 6: { amount: 2500, heal: ROAD_HITS / 2 }, 7: { amount: 2500, heal: ROAD_HITS / 2 }, 8: { amount: 2500, heal: ROAD_HITS } },
  [STRUCTURE_WALL]: { 0: { amount: 0, heal: 0 }, 1: { amount: 0, heal: 0 }, 2: { amount: 2500, heal: WALL_HEALTH.small }, 3: { amount: 2500, heal: WALL_HEALTH.small }, 4: { amount: 2500, heal: WALL_HEALTH.small }, 5: { amount: 2500, heal: WALL_HEALTH.small }, 6: { amount: 2500, heal: WALL_HEALTH.big / 2 }, 7: { amount: 2500, heal: WALL_HEALTH.big / 2 }, 8: { amount: 2500, heal: WALL_HEALTH.big } },
  [STRUCTURE_RAMPART]: { 0: { amount: 0, heal: 0 }, 1: { amount: 0, heal: 0 }, 2: { amount: 2500, heal: WALL_HEALTH.small }, 3: { amount: 2500, heal: WALL_HEALTH.small }, 4: { amount: 2500, heal: WALL_HEALTH.small }, 5: { amount: 2500, heal: WALL_HEALTH.small }, 6: { amount: 2500, heal: WALL_HEALTH.big / 2 }, 7: { amount: 2500, heal: WALL_HEALTH.big / 2 }, 8: { amount: 2500, heal: WALL_HEALTH.big } }
}
const BUILDABLE_PRIORITY: BuildableStructureConstant[] = [
  STRUCTURE_TOWER,
  STRUCTURE_SPAWN,
  STRUCTURE_EXTENSION,
  STRUCTURE_STORAGE,
  STRUCTURE_TERMINAL,
  STRUCTURE_EXTRACTOR,
  STRUCTURE_CONTAINER,
  STRUCTURE_LINK,
  STRUCTURE_LAB,
  STRUCTURE_OBSERVER,
  STRUCTURE_POWER_SPAWN,
  STRUCTURE_FACTORY,
  STRUCTURE_NUKER,
  STRUCTURE_ROAD,
  STRUCTURE_RAMPART,
  STRUCTURE_WALL,
];
type Job = { func: () => OK | ERR_BUSY | ERR_FULL, context: string };

const PATH_ARGS: FindPathOpts = {
  plainCost: 2, swampCost: 4, ignoreCreeps: true,
  costCallback: function(roomName: string, costMatrix: CostMatrix): CostMatrix | void {
    if (Apiary.planner.activePlanning[roomName]) {
      let plan = Apiary.planner.activePlanning[roomName].plan;
      for (let x in plan)
        for (let y in plan[x]) {
          if (plan[x][y].s === STRUCTURE_ROAD)
            costMatrix.set(+x, +y, 1);
          else if (plan[x][y].s)
            costMatrix.set(+x, +y, 255);
        }
      return costMatrix;
    }
  }
}

/*
let ss = "";
for (let t in [STRUCTURE_ROAD, STRUCTURE_WALL, STRUCTURE_RAMPART]) {
  let sss = ""
  let type = [STRUCTURE_ROAD, STRUCTURE_WALL, STRUCTURE_RAMPART][t];
  for (let lvl in CONTROLLER_STRUCTURES[type])
    sss += `${lvl}: {amount: ${CONTROLLER_STRUCTURES[type][lvl]}, heal: ${type.toUpperCase()}_HITS},`
  sss = sss.substring(0, sss.length - 1);
  ss += `STRUCTURE_${type.toUpperCase()}: {${sss}},`;
}
ss = ss.substring(0, ss.length - 1);
console.log(`{${ss}}`);
*/

function anchorDist(anchor: RoomPosition, x: Pos, roomName: string = anchor.roomName, pathfind = false) {
  if (pathfind)
    return anchor.getTimeForPath(new RoomPosition(x.x, x.y, roomName));
  return anchor.getRangeTo(new RoomPosition(x.x, x.y, roomName));
}

@profile
export class RoomPlanner {
  activePlanning: {
    [id: string]: {
      plan: { [id: number]: { [id: number]: { s: BuildableStructureConstant | undefined | null, r: boolean } } },
      placed: { [key in StructureConstant]?: number },
      freeSpaces: Pos[], exits: RoomPosition[],
      jobsToDo: Job[]; // ERR_BUSY - repeat job, ERR_FULL - failed
      correct: "ok" | "fail" | "work";
      anchor?: RoomPosition,
      poss: PossiblePositions,
    }
  } = {};

  run() {
    // CPU for planner - least important one
    for (let roomName in this.activePlanning) {
      if (this.activePlanning[roomName].correct === "work") {
        let jobs = this.activePlanning[roomName].jobsToDo;
        while (jobs.length) {
          let ans;
          console.log("?:", jobs[0].context)
          ans = jobs[0].func();
          if (ans === ERR_FULL) {
            this.activePlanning[roomName].correct = "fail";
            console.log("FAIL: ", jobs[0].context);
          }
          if (ans === ERR_BUSY)
            break;
          jobs.shift();
        }
        if (!jobs.length && this.activePlanning[roomName].correct !== "fail") {
          console.log("OK: ", roomName);
          this.activePlanning[roomName].correct = "ok";
        }
      }
    }
  }

  initPlanning(roomName: string, correct: boolean = false) {
    this.activePlanning[roomName] = { plan: [], placed: {}, freeSpaces: [], exits: [], jobsToDo: [], correct: correct ? "ok" : "work", poss: {} };
    for (let t in CONSTRUCTION_COST)
      this.activePlanning[roomName].placed[<BuildableStructureConstant>t] = 0;
  }

  generatePlan(anchor: RoomPosition, baseRotation: 0 | 1 | 2 | 3 = 0) {
    this.initPlanning(anchor.roomName);
    let jobs = this.activePlanning[anchor.roomName].jobsToDo;
    this.activePlanning[anchor.roomName].anchor = anchor;
    let rotate = (pos: Pos, direction: 0 | 1 | 2 | 3, shiftY: number = 0, shiftX: number = 0) => {
      let x = pos.x - 25;
      let y = pos.y - 25;
      let temp;
      switch (direction) {
        case 1: // reverse
          x = -x;
          y = -y;
          break;
        case 2: // left
          temp = x;
          x = -y;
          y = temp;
          break;
        case 3: // right (clockwise)
          temp = x;
          x = y;
          y = -temp;
          break;
      }
      return { x: x + (anchor.x + shiftX), y: y + (anchor.y + shiftY) };
    }

    const extra_modules = {
      1: () => this.addModule(anchor, EXTRA_VERTICAL, (a) => rotate(a, 0, -3)),
      5: () => this.addModule(anchor, EXTRA_VERTICAL, (a) => rotate(a, 1, 3)),
      3: () => this.addModule(anchor, EXTRA_HORIZONTAL, (a) => rotate(a, 1, 0)),
      7: () => this.addModule(anchor, EXTRA_HORIZONTAL, (a) => rotate(a, 0)),
    }
    let baseRotationRemove: { [id in number]: ExitConstant } = {
      2: 1,
      3: 5,
      1: 3,
      0: 7,
    }
    let order: ExitConstant[] = [1, 5, 3, 7];
    order.splice(order.indexOf(baseRotationRemove[baseRotation]), 1);
    order.sort((a, b) => {
      if (Game.map.describeExits(anchor.roomName)[a]) {
        if (!Game.map.describeExits(anchor.roomName)[b])
          return -1;
      } else if (Game.map.describeExits(anchor.roomName)[b])
        return 1;
      return 0;
    });
    _.forEach(order, oo => extra_modules[oo]());
    this.addModule(anchor, baseRotation > 1 ? BASE_VERTICAL : BASE_HORIZONTAL, (a) => rotate(a, baseRotation));

    let futureResourceCells = _.filter(Game.flags, (f) => f.color === COLOR_YELLOW && f.memory.hive === anchor.roomName);
    futureResourceCells.sort((a, b) => {
      let ans = anchor.getRoomRangeTo(a) - anchor.getRoomRangeTo(b);
      if (ans === 0)
        return anchor.getTimeForPath(a) - anchor.getTimeForPath(b);
      return ans;
    });
    _.forEach(futureResourceCells, (f) => {
      jobs.push({
        context: `resource roads for ${f.pos}`,
        func: () => {
          let ans = this.connectWithRoad(anchor, f.pos, true);
          if (ans === ERR_FULL || ans === ERR_BUSY)
            return ans;
          if (!f.pos.findInRange(FIND_STRUCTURES, 2).filter((s) => s.structureType === STRUCTURE_LINK).length)
            this.addToPlan(ans, f.pos.roomName, STRUCTURE_CONTAINER, true);
          if (f.secondaryColor === COLOR_CYAN)
            this.addToPlan(f.pos, f.pos.roomName, STRUCTURE_EXTRACTOR);
          return OK;
        }
      });
    });

    jobs.push({
      context: "upgrade site",
      func: () => {
        if (!(anchor.roomName in Game.rooms))
          return ERR_FULL;
        let contr = Game.rooms[anchor.roomName].controller;
        if (contr) {
          let poss = contr.pos.getOpenPositions(true);
          _.forEach(poss, (p) => this.addToPlan(p, anchor.roomName, STRUCTURE_WALL));
          poss = contr.pos.getPositionsInRange(3);
          if (!poss.length)
            return ERR_FULL;
          let len = this.pathFromExit(poss[0], anchor.roomName);
          if (this.addToPlan(poss[0], anchor.roomName, STRUCTURE_LINK, false, true) !== OK)
            len = ERR_FULL;
          let pos = poss.reduce((prev, curr) => {
            if (!this.roadNearBy(curr, anchor.roomName) && this.addToPlan(curr, anchor.roomName, STRUCTURE_LINK, false, true) === OK) {
              let pathCurr = this.pathFromExit(curr, anchor.roomName);
              if (len === ERR_FULL || pathCurr !== ERR_FULL && pathCurr[0].length < len[0].length) {
                len = pathCurr;
                return curr;
              }
            }
            return prev;
          });
          if (this.addToPlan(pos, anchor.roomName, STRUCTURE_LINK) !== OK)
            return ERR_FULL;
          this.connectWithRoad(anchor, pos);
        }
        return OK;
      }
    });

    jobs.push({
      context: "exits to rooms",
      func: () => {
        let exitsGlobal = Game.map.describeExits(anchor.roomName);
        for (let e in exitsGlobal) {
          let exits = false
          for (let e in this.activePlanning[anchor.roomName].exits)
            if (exitsGlobal[<ExitConstant>+e] === this.activePlanning[anchor.roomName].exits[e].roomName)
              exits = true;
          if (!exits) {
            let exit = anchor.findClosest(Game.rooms[anchor.roomName].find(<ExitConstant>+e));
            if (exit)
              this.connectWithRoad(anchor, exit, false);
          }
        }
        return OK;
      }
    });

    let fillTypes = [STRUCTURE_EXTENSION, STRUCTURE_POWER_SPAWN, STRUCTURE_FACTORY, STRUCTURE_OBSERVER];

    for (let i in fillTypes) {
      let sType = fillTypes[i];
      jobs.push({
        context: `placing ${sType}`,
        func: () => {
          let free = this.activePlanning[anchor.roomName].freeSpaces;
          if (this.activePlanning[anchor.roomName].placed[sType]!! < CONTROLLER_STRUCTURES[sType][8]) {
            let red = ((a: Pos, b: Pos) => {
              if (sType === STRUCTURE_EXTENSION && anchorDist(anchor, b) <= 1)
                return a;
              let ans = (anchorDist(anchor, a) - anchorDist(anchor, b)) * (sType === STRUCTURE_OBSERVER ? -1 : 1);
              if (ans === 0) {
                let pathA = anchor.findPathTo(new RoomPosition(a.x, a.y, anchor.roomName), PATH_ARGS);
                let pathB = anchor.findPathTo(new RoomPosition(b.x, b.y, anchor.roomName), PATH_ARGS);
                ans = pathA.length - pathB.length;
              }
              if (ans === 0)
                ans = (a.y - b.y) * (baseRotation !== 3 ? -1 : 1);
              if (ans === 0)
                ans = (a.x - b.x) * (baseRotation !== 1 ? -1 : 1);
              return ans < 0 ? a : b;
            });
            let pos;
            if (free.length)
              pos = free.reduce(red);

            let br = false;
            while (pos) {
              if ((sType === STRUCTURE_OBSERVER || this.roadNearBy(pos, anchor.roomName)) && this.addToPlan(pos, anchor.roomName, sType) === ERR_FULL)
                br = true;
              else {
                for (let i = 0; i < free.length; ++i)
                  if (free[i].x === pos.x && free[i].y === pos.y) {
                    free.splice(i, 1);
                    break;
                  }
                pos = free.reduce(red);
              }
              if (br)
                break;
            }
            if (this.activePlanning[anchor.roomName].placed[sType]! < CONTROLLER_STRUCTURES[sType][8])
              return ERR_FULL;
          }
          this.activePlanning[anchor.roomName].freeSpaces = free;
          return OK;
        }
      });
    }

    this.addModule(anchor, WALLS, (a) => rotate(a, baseRotation));
  }

  roadNearBy(p: Pos, roomName: string) {
    let startX = p.x - 1 || 1;
    let startY = p.y - 1 || 1;
    let plan = this.activePlanning[roomName].plan;
    for (let x = startX; x <= p.x + 1 && x < 49; x++)
      for (let y = startY; y <= p.y + 1 && y < 49; y++)
        if (plan[x] && plan[x][y] && plan[x][y].s === STRUCTURE_ROAD)
          return true;
    return false;
  }

  pathFromExit(pos: RoomPosition, roomName: string): ERR_FULL | [PathStep[], RoomPosition] {
    if (!(pos.roomName in Game.rooms))
      return ERR_FULL;
    let exit: RoomPosition | undefined | null;
    if (pos.roomName === roomName)
      exit = pos.findClosestByPath(this.activePlanning[roomName].exits, PATH_ARGS);
    if (!exit)
      exit = pos.findClosest(this.activePlanning[roomName].exits);
    if (!exit)
      return ERR_FULL;
    return [exit.findPathTo(pos, PATH_ARGS), exit];
  }

  connectWithRoad(anchor: RoomPosition, pos: RoomPosition, addRoads: boolean = anchor.roomName === pos.roomName): Pos | ERR_BUSY | ERR_FULL {
    let ans = this.pathFromExit(pos, anchor.roomName);
    if (ans === ERR_FULL)
      return ans;
    let [path, exit] = ans;
    if (path.length === 0)
      return ERR_FULL;

    let lastPath = path.pop()!;
    if (addRoads)
      _.forEach(path, (pos) => this.addToPlan(pos, exit!.roomName, STRUCTURE_ROAD));
    else
      _.forEach(path, (pos) => this.addToPlan(pos, exit!.roomName, null));

    // console.log(`${anchor} ->   ${exit}-${path.length}->${new RoomPosition(lastPath.x, lastPath.y, exit.roomName)}   -> ${pos}`);
    exit = new RoomPosition(lastPath.x, lastPath.y, exit.roomName);
    if (pos.x !== lastPath.x || pos.y !== lastPath.y || pos.roomName !== exit.roomName) {
      let ent = exit.getEnteranceToRoom();
      this.activePlanning[anchor.roomName].exits.push(ent ? ent : exit);
      return ERR_BUSY;
    }
    return path.length > 0 ? new RoomPosition(path[path.length - 1].x, path[path.length - 1].y, exit.roomName) : exit;
  }

  addToPlan(pos: Pos, roomName: string, sType: BuildableStructureConstant | null, force: boolean = false, check: boolean = false) {
    if (!this.activePlanning[roomName])
      this.initPlanning(roomName);
    if (check && (sType === STRUCTURE_RAMPART || sType === STRUCTURE_WALL || force))
      return ERR_INVALID_ARGS;
    if (Game.map.getRoomTerrain(roomName).get(pos.x, pos.y) === TERRAIN_MASK_WALL && sType !== STRUCTURE_EXTRACTOR)
      return ERR_NO_PATH;
    let placed = this.activePlanning[roomName].placed;
    let plan = this.activePlanning[roomName].plan;
    if (!plan[pos.x])
      plan[pos.x] = {};
    if (!plan[pos.x][pos.y])
      plan[pos.x][pos.y] = { s: undefined, r: false };
    if (sType === STRUCTURE_RAMPART)
      plan[pos.x][pos.y] = { s: plan[pos.x][pos.y].s, r: true };
    else if (plan[pos.x][pos.y].s === undefined) {
      if (check)
        return OK;
      if (sType) {
        if (placed[sType]! >= CONTROLLER_STRUCTURES[sType][8])
          return ERR_FULL;
        placed[sType]!++;
      }
      plan[pos.x][pos.y] = { s: sType, r: plan[pos.x][pos.y].r };
    } else if (sType === STRUCTURE_WALL && plan[pos.x][pos.y].s !== STRUCTURE_WALL)
      plan[pos.x][pos.y] = { s: plan[pos.x][pos.y].s, r: true };
    else if (force) {
      if (plan[pos.x][pos.y].s)
        placed[plan[pos.x][pos.y].s!]!--;
      plan[pos.x][pos.y] = { s: sType, r: plan[pos.x][pos.y].r };
      if (sType)
        placed[sType]!++;
    } else
      return ERR_NO_PATH;
    return OK;
  }

  addModule(anchor: { x: number, y: number, roomName: string }, configuration: Module, transformPos: (a: Pos) => Pos) {
    this.activePlanning[anchor.roomName].jobsToDo.push({
      context: "adding module",
      func: () => {
        this.activePlanning[anchor.roomName].freeSpaces = this.activePlanning[anchor.roomName].freeSpaces
          .concat(configuration.freeSpaces.map((p) => transformPos(p)).filter((p) => Game.map.getRoomTerrain(anchor.roomName).get(p.x, p.y) !== TERRAIN_MASK_WALL));

        this.activePlanning[anchor.roomName].exits = this.activePlanning[anchor.roomName].exits
          .concat(configuration.exits.map((p) => {
            let ans = transformPos(p);
            return new RoomPosition(ans.x, ans.y, anchor.roomName);
          }).filter((p) => Game.map.getRoomTerrain(anchor.roomName).get(p.x, p.y) !== TERRAIN_MASK_WALL));

        for (let type in configuration.poss) {
          let p = transformPos(configuration.poss[<keyof PossiblePositions>type]!)
          if (Game.map.getRoomTerrain(anchor.roomName).get(p.x, p.y) !== TERRAIN_MASK_WALL)
            this.activePlanning[anchor.roomName].poss[<keyof PossiblePositions>type] = p;
        }

        for (let t in configuration.setup) {
          let sType = <BuildableStructureConstant>t;
          let poss = configuration.setup[sType]!.pos;
          for (let i = 0; i < poss.length; ++i) {
            let ans = transformPos(poss[i]);
            if (this.addToPlan(ans, anchor.roomName, sType) === ERR_FULL)
              this.activePlanning[anchor.roomName].freeSpaces.push(ans);
          }
        }
        return OK;
      }
    });
  }

  toActive(roomName: string) {
    this.initPlanning(roomName, true);
    for (let t in Memory.cache.roomPlanner[roomName]) {
      let sType = <BuildableStructureConstant>t;
      let poss = Memory.cache.roomPlanner[roomName][sType]!.pos;
      for (let i = 0; i < poss.length; ++i)
        this.addToPlan(poss[i], roomName, sType, true);
      if (!poss.length)
        delete Memory.cache.roomPlanner[roomName][sType];
    }

    if (Memory.cache.positions[roomName])
      for (let type in Memory.cache.positions[roomName])
        this.activePlanning[roomName].poss[<keyof PossiblePositions>type] = Memory.cache.positions[roomName][<keyof PossiblePositions>type]!;
  }

  resetPlanner(roomName: string) {
    if (!this.activePlanning[roomName])
      return;
    Memory.cache.roomPlanner[roomName] = {};
    _.forEach((<(Structure | ConstructionSite)[]>Game.rooms[roomName].find(FIND_STRUCTURES))
      .concat(Game.rooms[roomName].find(FIND_CONSTRUCTION_SITES)),
      (s) => {
        if (!(s.structureType in CONTROLLER_STRUCTURES))
          return;
        if (this.getCase(s).amount === 0)
          return;
        if (s.pos.getEnteranceToRoom())
          return;
        this.addToCache(s.pos, s.pos.roomName, <BuildableStructureConstant>s.structureType);
      });
  }

  saveActive(roomName: string, anchor: RoomPosition) {
    let active = this.activePlanning[roomName];
    if (!(active))
      return;
    Memory.cache.roomPlanner[roomName] = {};
    for (let x in active.plan)
      for (let y in active.plan[+x]) {
        if (active.plan[+x][+y].s)
          this.addToCache({ x: +x, y: +y }, roomName, active.plan[+x][+y].s!);
        if (active.plan[+x][+y].r || active.plan[+x][+y].s === STRUCTURE_TOWER)
          this.addToCache({ x: +x, y: +y }, roomName, STRUCTURE_RAMPART);
      }

    for (let t in Memory.cache.roomPlanner[roomName]) {
      let sType = <BuildableStructureConstant>t;
      let poss = Memory.cache.roomPlanner[roomName][sType]!.pos;
      poss.sort((a, b) => {
        let ans = anchorDist(anchor, a, roomName) - anchorDist(anchor, b, roomName);
        if (ans === 0)
          ans = anchorDist(anchor, a, roomName, true) - anchorDist(anchor, b, roomName, true);
        return ans;
      });
      Memory.cache.roomPlanner[roomName][sType]!.pos = poss;
    }

    if (Memory.cache.positions[roomName])
      for (let type in this.activePlanning[roomName].poss)
        Memory.cache.positions[roomName][<keyof PossiblePositions>type] = this.activePlanning[roomName].poss[<keyof PossiblePositions>type]!;
  }

  addToCache(pos: Pos, roomName: string, sType: BuildableStructureConstant) {
    if (!Memory.cache.roomPlanner[roomName][sType])
      Memory.cache.roomPlanner[roomName][sType] = { pos: [] };
    Memory.cache.roomPlanner[roomName][sType]!.pos.push({ x: pos.x, y: pos.y });
  }

  getCase(structure: Structure | ConstructionSite | { structureType: StructureConstant, pos: { roomName: string }, hitsMax: number }) {
    let controller: StructureController | { level: number } | undefined = Game.rooms[structure.pos.roomName] && Game.rooms[structure.pos.roomName].controller;
    if (!controller)
      controller = { level: 0 };
    let specialCase = SPECIAL_STRUCTURE[structure.structureType] && SPECIAL_STRUCTURE[structure.structureType]![controller!.level];
    return specialCase ? specialCase : {
      amount: CONTROLLER_STRUCTURES[<BuildableStructureConstant>structure.structureType][controller!.level]
      , heal: structure instanceof ConstructionSite ? structure.progressTotal : structure.hitsMax,
    };
  }

  checkBuildings(roomName: string, priorityQue = BUILDABLE_PRIORITY) {
    if (!(roomName in Game.rooms) || !Memory.cache.roomPlanner[roomName])
      return [];

    let contr = Game.rooms[roomName].controller
    let myRoom = contr && contr.my;
    let controller: StructureController | { level: number } | undefined = contr;
    if (!controller)
      controller = { level: 0 };

    let ans: BuildProject[] = [];
    let constructions = 0;
    for (let i = 0; i < priorityQue.length; ++i) {
      let sType = priorityQue[i];
      if (!(sType in Memory.cache.roomPlanner[roomName]))
        continue;
      let cc = this.getCase({ structureType: sType, pos: { roomName: roomName }, hitsMax: 0 });
      let toadd: RoomPosition[] = [];
      let placed = 0;
      let positions = Memory.cache.roomPlanner[roomName][sType]!.pos;
      for (let i = 0; i < positions.length; ++i) {
        let pos = new RoomPosition(positions[i].x, positions[i].y, roomName);
        let structure = <Structure<BuildableStructureConstant> | undefined>_.filter(pos.lookFor(LOOK_STRUCTURES),
          (s) => s.structureType === sType)[0];
        if (!structure) {
          if (constructions < 10) {
            let constructionSite = _.filter(pos.lookFor(LOOK_CONSTRUCTION_SITES), (s) => s.structureType === sType)[0];
            if (!constructionSite) {
              let place = _.filter(pos.lookFor(LOOK_STRUCTURES), (s) => s.structureType !== STRUCTURE_RAMPART)[0];
              if (place && sType !== STRUCTURE_RAMPART) {
                if (myRoom) {
                  place.destroy();
                } else if (!place.pos.lookFor(LOOK_FLAGS).length)
                  place.pos.createFlag("remove_" + makeId(4), COLOR_GREY, COLOR_RED);
              } else
                toadd.push(pos);
            } else {
              ans.push({
                pos: pos,
                sType: sType,
                targetHits: 0,
                energyCost: constructionSite.progressTotal - constructionSite.progress,
              });
              constructions++;
            }
          }
        } else if (structure) {
          placed++;
          let heal = this.getCase(structure).heal;
          if ((structure.hits < heal * 0.5 && !constructions) || structure.hits < heal * 0.25)
            ans.push({
              pos: pos,
              sType: sType,
              targetHits: heal,
              energyCost: Math.ceil((heal - structure.hits) / 100),
            });
        }
      }
      for (let i = 0; i < toadd.length && i < cc.amount - placed && constructions < 10; ++i) {
        if (sType === STRUCTURE_SPAWN)
          toadd[i].createConstructionSite(sType, roomName.toLowerCase() + makeId(4));
        else
          toadd[i].createConstructionSite(sType);
        constructions++;
      }
    }

    return ans;
  }
}
