import { makeId } from "./utils";
import { roomStates } from "../enums";

import { profile } from "../profiler/decorator";

import type { PossiblePositions, BuildProject } from "../Hive";

export type RoomSetup = { [key in BuildableStructureConstant]?: { pos: { x: number, y: number }[] } };

type Module = { setup: RoomSetup, freeSpaces: Pos[], exits: Pos[], poss: PossiblePositions };

// well i can add more
// len 6 including center
const BASE: Module = { poss: { center: { x: 25, y: 25 }, lab: { x: 20, y: 26 }, queen1: { x: 25, y: 25 } }, exits: [{ x: 20, y: 26 }, { x: 20, y: 24 }], freeSpaces: [{ x: 19, y: 23 }, { x: 19, y: 24 }, { x: 19, y: 25 }, { x: 19, y: 26 }, { x: 19, y: 27 }, { x: 23, y: 28 }, { x: 23, y: 22 }, { x: 22, y: 27 }, { x: 22, y: 23 }, { x: 25, y: 24 }, { x: 26, y: 24 }, { x: 26, y: 25 }, { x: 20, y: 28 }, { x: 21, y: 28 }, { x: 20, y: 30 }, { x: 21, y: 30 }, { x: 22, y: 29 }, { x: 21, y: 22 }, { x: 20, y: 22 }, { x: 20, y: 20 }, { x: 21, y: 20 }, { x: 22, y: 21 }, { x: 20, y: 21 }, { x: 20, y: 29 }, { x: 19, y: 21 }, { x: 19, y: 22 }, { x: 19, y: 20 }, { x: 19, y: 29 }, { x: 19, y: 30 }, { x: 19, y: 28 }], setup: { road: { pos: [{ x: 25, y: 25 }, { x: 26, y: 26 }, { x: 24, y: 24 }, { x: 23, y: 24 }, { x: 24, y: 23 }, { x: 26, y: 27 }, { x: 27, y: 26 }, { x: 28, y: 25 }, { x: 25, y: 22 }, { x: 27, y: 24 }, { x: 26, y: 23 }, { x: 25, y: 28 }, { x: 22, y: 25 }, { x: 23, y: 26 }, { x: 24, y: 27 }, { x: 21, y: 25 }, { x: 20, y: 24 }, { x: 20, y: 26 }, { x: 23, y: 23 }, { x: 22, y: 22 }, { x: 21, y: 21 }, { x: 23, y: 27 }, { x: 22, y: 28 }, { x: 21, y: 29 }] }, lab: { pos: [{ x: 21, y: 24 }, { x: 22, y: 24 }, { x: 23, y: 25 }, { x: 22, y: 26 }, { x: 21, y: 26 }, { x: 20, y: 25 }, { x: 20, y: 23 }, { x: 21, y: 23 }, { x: 20, y: 27 }, { x: 21, y: 27 }] }, storage: { pos: [{ x: 25, y: 26 }] }, link: { pos: [{ x: 24, y: 25 }] }, terminal: { pos: [{ x: 24, y: 26 }] } } };

// len 7 including center
const EXTRA_OPPOSITE: Module = { poss: { queen2: { x: 27, y: 25 } }, exits: [{ x: 23, y: 22 }, { x: 25, y: 22 }, { x: 27, y: 22 }], freeSpaces: [{ x: 22, y: 21 }, { x: 23, y: 21 }, { x: 24, y: 21 }, { x: 25, y: 21 }, { x: 26, y: 21 }, { x: 27, y: 21 }, { x: 28, y: 21 }, { x: 23, y: 26 }, { x: 24, y: 25 }, { x: 26, y: 25 }, { x: 27, y: 26 }, { x: 24, y: 24 }, { x: 26, y: 24 }, { x: 27, y: 24 }, { x: 27, y: 23 }, { x: 28, y: 23 }, { x: 28, y: 26 }, { x: 28, y: 25 }, { x: 29, y: 25 }, { x: 29, y: 24 }, { x: 30, y: 24 }, { x: 30, y: 23 }, { x: 30, y: 22 }, { x: 29, y: 22 }, { x: 28, y: 22 }, { x: 23, y: 24 }, { x: 23, y: 23 }, { x: 22, y: 23 }, { x: 22, y: 22 }, { x: 21, y: 22 }, { x: 20, y: 22 }, { x: 20, y: 23 }, { x: 21, y: 24 }, { x: 21, y: 25 }, { x: 22, y: 25 }, { x: 22, y: 26 }, { x: 20, y: 24 }, { x: 30, y: 21 }, { x: 29, y: 21 }, { x: 21, y: 21 }, { x: 20, y: 21 }], setup: { road: { pos: [{ x: 25, y: 24 }, { x: 23, y: 25 }, { x: 22, y: 24 }, { x: 21, y: 23 }, { x: 27, y: 25 }, { x: 26, y: 23 }, { x: 24, y: 23 }, { x: 25, y: 22 }, { x: 27, y: 22 }, { x: 23, y: 22 }, { x: 28, y: 24 }, { x: 29, y: 23 }] }, spawn: { pos: [{ x: 25, y: 26 }] }, tower: { pos: [{ x: 25, y: 23 }, { x: 24, y: 22 }, { x: 26, y: 22 }] } } };

// len 6 including center
const EXTRA_SIDE: Module = { poss: {}, exits: [{ x: 20, y: 23 }, { x: 20, y: 27 }], freeSpaces: [{ x: 21, y: 25 }, { x: 22, y: 24 }, { x: 22, y: 26 }, { x: 21, y: 27 }, { x: 20, y: 28 }, { x: 20, y: 22 }, { x: 21, y: 23 }, { x: 19, y: 23 }, { x: 19, y: 22 }, { x: 19, y: 25 }, { x: 19, y: 26 }, { x: 19, y: 27 }, { x: 19, y: 28 }, { x: 19, y: 24 }, { x: 19, y: 21 }, { x: 19, y: 29 }, { x: 19, y: 30 }, { x: 19, y: 20 }], setup: { road: { pos: [{ x: 20, y: 23 }, { x: 22, y: 25 }, { x: 21, y: 26 }, { x: 20, y: 27 }, { x: 21, y: 24 }] }, spawn: { pos: [{ x: 23, y: 25 }] }, tower: { pos: [{ x: 20, y: 24 }, { x: 20, y: 26 }, { x: 20, y: 25 }] } } };

// box of 12 x 11 spawns at dist 1 from center except the opposite of biggest side

const CONSTRUCTIONS_PER_TYPE = 4;

export const WALL_HEALTH = 10000;

// oh no i need to def
const ADD_RAMPART: (BuildableStructureConstant | undefined | null)[] = []//STRUCTURE_TOWER, STRUCTURE_SPAWN, STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_LAB, STRUCTURE_FACTORY, STRUCTURE_NUKER, STRUCTURE_POWER_SPAWN]; // STRUCTURE_LINK

type Job = { func: () => OK | ERR_BUSY | ERR_FULL, context: string };
interface CoustomFindPathOpts extends FindPathOpts { ignoreTypes?: BuildableStructureConstant[] };
function getPathArgs(opts: CoustomFindPathOpts = {}): FindPathOpts {
  return _.defaults(opts, {
    plainCost: 2, swampCost: 6, ignoreCreeps: true, ignoreDestructibleStructures: true, ignoreRoads: false, maxRooms: 1,
    costCallback: function(roomName: string, costMatrix: CostMatrix): CostMatrix | void {
      if (Apiary.planner.activePlanning[roomName]) {
        let plan = Apiary.planner.activePlanning[roomName].plan;
        for (let x in plan)
          for (let y in plan[x]) {
            let sType = plan[x][y].s
            if (sType && (!opts.ignoreTypes || !opts.ignoreTypes.includes(sType)))
              if (sType === STRUCTURE_ROAD)
                costMatrix.set(+x, +y, 0x01);
              else if (sType === STRUCTURE_WALL)
                costMatrix.set(+x, +y, 0x05);
              else
                costMatrix.set(+x, +y, 0xff);
          }


        let roomInfo = Apiary.intel.getInfo(roomName, Infinity);
        let room = Game.rooms[roomName];
        if (roomInfo.roomState === roomStates.SKfrontier && room) {
          for (let structure of room.find<Structure>(FIND_STRUCTURES))
            if (structure instanceof StructureKeeperLair) {
              _.forEach(structure.pos.getOpenPositions(true, 3), p => costMatrix.set(p.x, p.y,
                Math.max(costMatrix.get(p.x, p.y), 0x03 * (4 - p.getTimeForPath(structure)))));
              costMatrix.set(structure.pos.x, structure.pos.y, 0xff);
            }
        }
        return costMatrix;
      }
    }
  });
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
console. log(`{${ss}}`);
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
      anchor: RoomPosition,
      poss: PossiblePositions,
    }
  } = {};

  run() {
    // CPU for planner - least important one
    for (let roomName in this.activePlanning) {
      let jobs = this.activePlanning[roomName].jobsToDo;
      while (jobs.length) {
        this.activePlanning[roomName].correct = "work";
        let ans;
        ans = jobs[0].func();
        //console .log("?:", jobs[0].context, ans);
        if (ans === ERR_FULL) {
          this.activePlanning[roomName].correct = "fail";
          console.log("FAIL: ", jobs[0].context);
        }
        if (ans === ERR_BUSY)
          break;
        jobs.shift();
      }
      if (!jobs.length && this.activePlanning[roomName].correct === "work") {
        console.log("OK: ", roomName);
        this.activePlanning[roomName].correct = "ok";
      }
    }
  }

  initPlanning(roomName: string, anchor: RoomPosition) {
    this.activePlanning[roomName] = { plan: [], placed: {}, freeSpaces: [], exits: [], jobsToDo: [], correct: "ok", poss: {}, anchor: anchor };
    for (let t in CONSTRUCTION_COST)
      this.activePlanning[roomName].placed[<BuildableStructureConstant>t] = 0;
  }

  generatePlan(anchor: RoomPosition, rotation: ExitConstant, warchance = true) {
    this.initPlanning(anchor.roomName, anchor);
    let jobs = this.activePlanning[anchor.roomName].jobsToDo;
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

    let rotationBase: { [id in ExitConstant]: 0 | 1 | 2 | 3 } = {
      [TOP]: 2,
      [BOTTOM]: 3,
      [RIGHT]: 1,
      [LEFT]: 0,
    }
    const extra_modules: { [key in ExitConstant]: [Module, (a: Pos) => Pos] } = {
      [TOP]: [EXTRA_SIDE, (a: Pos) => rotate(a, 2)],
      [BOTTOM]: [EXTRA_SIDE, (a: Pos) => rotate(a, 3)],
      [RIGHT]: [EXTRA_SIDE, (a: Pos) => rotate(a, 1)],
      [LEFT]: [EXTRA_SIDE, (a: Pos) => rotate(a, 0)],
    }
    switch (rotation) {
      case TOP:
        extra_modules[BOTTOM] = [EXTRA_OPPOSITE, (a: Pos) => rotate(a, 1, 3)];
        break;
      case BOTTOM:
        extra_modules[TOP] = [EXTRA_OPPOSITE, (a: Pos) => rotate(a, 0, -3)];
        break;
      case RIGHT:
        extra_modules[LEFT] = [EXTRA_OPPOSITE, (a: Pos) => rotate(a, 3, 0, -3)];
        break;
      case LEFT:
        extra_modules[RIGHT] = [EXTRA_OPPOSITE, (a: Pos) => rotate(a, 2, 0, 3)];
        break;
    }

    let order: ExitConstant[] = [1, 5, 3, 7];
    order.splice(order.indexOf(rotation), 1);
    order.sort((a, b) => {
      let exits = Game.map.describeExits(anchor.roomName);
      if (!exits)
        return 0;
      else if (exits[a]) {
        if (!exits[b])
          return -1;
      } else if (exits[b])
        return 1;

      let room = Game.rooms[anchor.roomName];
      if (!room)
        return 0;

      let getTime = (x: ExitConstant) => {
        let tower = extra_modules[x][0].setup.tower;
        let anchorTemp = tower ? new RoomPosition(tower.pos[0].x, tower.pos[0].y, anchor.roomName) : anchor;
        let close = anchorTemp.findClosest(room.find(x));
        if (!close)
          return Infinity;
        let path = close.findPathTo(anchorTemp, getPathArgs());
        if (!path.length)
          return Infinity;
        let last = path[path.length - 1];
        if (last.x === anchorTemp.x && last.y === anchorTemp.y)
          return path.length;
        return anchorDist(close, last);
      }

      return getTime(a) - getTime(b);
    });

    _.forEach(order, oo => this.addModule(anchor, extra_modules[oo][0], extra_modules[oo][1]));
    this.addModule(anchor, BASE, a => rotate(a, rotationBase[rotation]));

    let customRoads = _.filter(Game.flags, f => f.color === COLOR_WHITE && f.secondaryColor === COLOR_PURPLE);
    customRoads.sort((a, b) => {
      let ans = anchor.getRoomRangeTo(a) - anchor.getRoomRangeTo(b);
      if (ans === 0)
        return anchor.getTimeForPath(a) - anchor.getTimeForPath(b);
      return ans;
    });

    _.forEach(customRoads, f => this.addCustomRoad(anchor, f.pos));

    let customBuildings = _.filter(Game.flags, f => f.color === COLOR_WHITE && f.secondaryColor === COLOR_RED);
    _.forEach(customBuildings, f => (f.name in CONSTRUCTION_COST) && this.addToPlan(f.pos, f.pos.roomName, <BuildableStructureConstant>f.name), true);

    jobs.push({
      context: "outer ring",
      func: () => {
        let addedWalls: Pos[] = [];
        let terrain = Game.map.getRoomTerrain(anchor.roomName);
        let addXEnd = (coef: number, x: number, y: number) => {
          let close = y === 0 ? y + 1 : y - 1;
          let far = y === 0 ? y + 2 : y - 2;
          let inner = x - 1 * coef;
          let outer = x - 2 * coef;
          if (inner % 3 == 0)
            this.addToPlan({ x: inner, y: far }, anchor.roomName, STRUCTURE_RAMPART);
          else
            this.addToPlan({ x: inner, y: far }, anchor.roomName, STRUCTURE_WALL);
          addedWalls.push({ x: inner, y: far });
          if (terrain.get(inner, close) === TERRAIN_MASK_WALL)
            return;
          this.addToPlan({ x: outer, y: close }, anchor.roomName, STRUCTURE_WALL);
          addedWalls.push({ x: outer, y: close });
          this.addToPlan({ x: outer, y: far }, anchor.roomName, STRUCTURE_WALL);
          addedWalls.push({ x: outer, y: far });
        };
        for (let y in { 0: 1, 49: 1 }) {
          let start = -1;
          let end = -1;
          let yy = +y === 0 ? +y + 2 : +y - 2;

          for (let x = 0; x <= 49; ++x) {
            if (terrain.get(x, +y) !== TERRAIN_MASK_WALL) {
              if (start === -1) {
                start = x;
                addXEnd(1, start, +y);
              }
              if (x % 3 == 0)
                this.addToPlan({ x: x, y: yy }, anchor.roomName, STRUCTURE_RAMPART);
              else
                this.addToPlan({ x: x, y: yy }, anchor.roomName, STRUCTURE_WALL);
              addedWalls.push({ x: x, y: yy });
              end = x;
            } else if (start !== -1) {
              let pos = new RoomPosition(start + Math.round((end - start) / 2), +y, anchor.roomName);
              jobs.push({
                context: "outer road to " + pos,
                func: () => {
                  let anss = this.connectWithRoad(anchor, pos, false);
                  if (typeof anss === "number")
                    return anss;
                  return OK;
                }
              });
              addXEnd(-1, end, +y);
              start = -1;
            }
          }
        }

        let addYEnd = (coef: number, x: number, y: number) => {
          let close = x === 0 ? x + 1 : x - 1;
          let far = x === 0 ? x + 2 : x - 2;
          let inner = y - 1 * coef;
          let outer = y - 2 * coef;
          if (inner % 3 == 0)
            this.addToPlan({ y: inner, x: far }, anchor.roomName, STRUCTURE_RAMPART);
          else
            this.addToPlan({ y: inner, x: far }, anchor.roomName, STRUCTURE_WALL);
          addedWalls.push({ y: inner, x: far });
          if (terrain.get(close, inner) === TERRAIN_MASK_WALL)
            return;
          this.addToPlan({ y: outer, x: close }, anchor.roomName, STRUCTURE_WALL);
          addedWalls.push({ y: outer, x: close });
          this.addToPlan({ y: outer, x: far }, anchor.roomName, STRUCTURE_WALL);
          addedWalls.push({ y: outer, x: close });
        };
        for (let x in { 0: 1, 49: 1 }) {
          let start = -1;
          let end = -1;
          let xx = +x === 0 ? +x + 2 : +x - 2;

          for (let y = 0; y <= 49; ++y) {
            if (terrain.get(+x, y) !== TERRAIN_MASK_WALL) {
              if (start === -1) {
                start = y;
                addYEnd(1, +x, start);
              }
              if (y % 3 == 0)
                this.addToPlan({ y: y, x: xx }, anchor.roomName, STRUCTURE_RAMPART);
              else
                this.addToPlan({ y: y, x: xx }, anchor.roomName, STRUCTURE_WALL);
              addedWalls.push({ y: y, x: xx });
              end = y;
            } else if (start !== -1) {
              let pos = new RoomPosition(+x, start + Math.round((end - start) / 2), anchor.roomName);
              jobs.push({
                context: "outer road to " + pos,
                func: () => {
                  let anss = this.connectWithRoad(anchor, pos, false);
                  if (typeof anss === "number")
                    return anss;
                  return OK;
                }
              });
              addYEnd(-1, +x, end);
              start = -1;
            }
          }
        }
        this.removeNonUsedWalls(anchor, addedWalls);
        return OK;
      },
    });

    this.addResourceRoads(anchor);

    jobs.push({
      context: "upgrade site",
      func: () => {
        if (!(anchor.roomName in Game.rooms))
          return ERR_FULL;
        let contr = Game.rooms[anchor.roomName].controller;
        if (contr) {
          let ans = this.connectWithRoad(anchor, contr.pos, false);
          if (typeof ans === "number")
            return ans;
          let poss = contr.pos.getPositionsInRange(1);
          _.forEach(poss, p => this.addToPlan(p, anchor.roomName, STRUCTURE_WALL));
          poss = contr.pos.getPositionsInRange(3);
          if (!poss.length)
            return ERR_FULL;
          let pos = poss.reduce((prev, curr) => {
            if (!this.roadNearBy(curr, anchor.roomName) && this.addToPlan(curr, anchor.roomName, STRUCTURE_LINK, false, true) === OK
              && anchor.getRangeTo(prev) > anchor.getRangeTo(curr) || this.addToPlan(prev, anchor.roomName, STRUCTURE_LINK, false, true) !== OK)
              return curr;
            return prev;
          });
          if (this.addToPlan(pos, anchor.roomName, STRUCTURE_LINK, true) !== OK)
            return ERR_FULL;
          return OK;
        }
        return ERR_FULL;
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
            let anchorTemp = anchor;
            if (sType === STRUCTURE_EXTENSION) {
              // in this setup cause whant to get extensions away from labs
              let t = rotate({ x: 26, y: 25 }, rotationBase[rotation])
              anchorTemp = new RoomPosition(t.x, t.y, anchor.roomName);
            }
            let red = ((a: Pos, b: Pos) => {
              if (sType === STRUCTURE_EXTENSION && anchorDist(anchorTemp, b) <= 1)
                return a;
              let ans = (anchorDist(anchorTemp, a) - anchorDist(anchorTemp, b));
              if (ans === 0 || sType === STRUCTURE_OBSERVER) {
                let pathA = new RoomPosition(a.x, a.y, anchor.roomName).findPathTo(anchorTemp, getPathArgs());
                if (!pathA.length || pathA[pathA.length - 1].x !== anchorTemp.x || pathA[pathA.length - 1].y !== anchorTemp.y)
                  ans = 1;
                let pathB = new RoomPosition(b.x, b.y, anchor.roomName).findPathTo(anchorTemp, getPathArgs());
                if (!pathB.length || pathB[pathB.length - 1].x !== anchorTemp.x || pathB[pathB.length - 1].y !== anchorTemp.y)
                  ans = -1;
                if (ans === 0)
                  ans = pathA.length - pathB.length;
              }
              ans *= sType === STRUCTURE_OBSERVER ? -1 : 1;
              if (ans === 0)
                ans = (a.y - b.y) * (rotation === TOP ? -1 : 1);
              if (ans === 0)
                ans = (a.x - b.x) * (rotation === LEFT ? -1 : 1);
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
                pos = undefined;
                if (free.length)
                  pos = free.reduce(red);
              }
              if (br)
                break;
            }
            if (this.activePlanning[anchor.roomName].placed[sType]! < CONTROLLER_STRUCTURES[sType][8])
              return ERR_FULL;
          }
          return OK;
        }
      });
    }

    if (warchance)
      this.addWalls(anchor, [4, 2])
  }

  addCustomRoad(anchor: RoomPosition, pos: RoomPosition) {
    if (!this.activePlanning[anchor.roomName])
      this.toActive(anchor)

    this.activePlanning[anchor.roomName].jobsToDo.push({
      context: `custom road for ${pos}`,
      func: () => {
        let ans = this.connectWithRoad(anchor, pos, true);
        if (typeof ans === "number")
          return ans;
        this.addToPlan(pos, pos.roomName, STRUCTURE_ROAD);
        return OK;
      }
    });
  }

  addResourceRoads(anchor: RoomPosition, fromMem = false) {

    let futureResourceCells = _.filter(Game.flags, f => f.color === COLOR_YELLOW && f.memory.hive === anchor.roomName);
    futureResourceCells.sort((a, b) => {
      let ans = anchor.getRoomRangeTo(a) - anchor.getRoomRangeTo(b);
      if (ans === 0)
        return anchor.getTimeForPath(a) - anchor.getTimeForPath(b);
      return ans;
    });

    if (fromMem)
      //this.toActive(anchor, undefined, [STRUCTURE_CONTAINER]);
      _.forEach(futureResourceCells, f => {
        if (!this.activePlanning[f.pos.roomName])
          this.toActive(f.pos, undefined, [STRUCTURE_CONTAINER]);
      });


    _.forEach(futureResourceCells, f => {
      this.activePlanning[anchor.roomName].jobsToDo.push({
        context: `resource road for ${f.pos}`,
        func: () => {
          this.activePlanning[anchor.roomName].exits = [anchor].concat(this.activePlanning[anchor.roomName].exits.filter(e => e.roomName !== anchor.roomName));
          let ans = this.connectWithRoad(anchor, f.pos, true);
          if (typeof ans === "number")
            return ans;
          if (f.secondaryColor === COLOR_YELLOW) {
            let existingContainer = f.pos.findInRange(FIND_STRUCTURES, 1).filter(s => s.structureType === STRUCTURE_CONTAINER)[0];
            let existingLink;
            if (f.pos.roomName === anchor.roomName)
              existingLink = f.pos.findInRange(FIND_STRUCTURES, 2).filter(s => s.structureType === STRUCTURE_LINK)[0];
            if (!existingLink)
              if (existingContainer && existingContainer.pos.getRangeTo(new RoomPosition(ans.x, ans.y, f.pos.roomName)) <= 1) {
                this.addToPlan(ans, f.pos.roomName, undefined, true);
                this.addToPlan(existingContainer.pos, f.pos.roomName, STRUCTURE_CONTAINER, true);
              } else
                this.addToPlan(ans, f.pos.roomName, STRUCTURE_CONTAINER, true);
            else
              this.addToPlan(ans, f.pos.roomName, undefined, true);

            if (f.pos.roomName !== anchor.roomName)
              return OK;
            let poss = new RoomPosition(ans.x, ans.y, f.pos.roomName).getPositionsInRange(1);
            if (!poss.length)
              return ERR_FULL;
            let plan = this.activePlanning[anchor.roomName].plan;
            let pos = poss.filter(p => plan[p.x] && plan[p.x][p.y] && plan[p.x][p.y].s === STRUCTURE_LINK)[0];
            if (!pos) {
              pos = poss.reduce((prev, curr) => {
                if (this.addToPlan(prev, anchor.roomName, STRUCTURE_LINK, false, true) !== OK
                  || this.addToPlan(curr, anchor.roomName, STRUCTURE_LINK, false, true) === OK && anchor.getRangeTo(prev) > anchor.getRangeTo(curr))
                  return curr;
                return prev;
              });
              if (this.addToPlan(pos, anchor.roomName, STRUCTURE_LINK) !== OK)
                return ERR_FULL;
            }
          } else if (f.secondaryColor === COLOR_CYAN) {
            let existingContainer = f.pos.findInRange(FIND_STRUCTURES, 1).filter(s => s.structureType === STRUCTURE_CONTAINER)[0];
            if (existingContainer && existingContainer.pos.getRangeTo(new RoomPosition(ans.x, ans.y, f.pos.roomName)) <= 1) {
              this.addToPlan(ans, f.pos.roomName, undefined, true);
              this.addToPlan(existingContainer.pos, f.pos.roomName, STRUCTURE_CONTAINER, true);
            } else
              this.addToPlan(ans, f.pos.roomName, STRUCTURE_CONTAINER, true);
            this.addToPlan(f.pos, f.pos.roomName, STRUCTURE_EXTRACTOR);
          }
          return OK;
        }
      });
    });
  }

  addWalls(anchor: RoomPosition, ranges: number[], ramparts = true) {
    ranges.forEach(range => {
      this.activePlanning[anchor.roomName].jobsToDo.push({
        context: "adding walls in range " + range,
        func: () => {
          let plan = this.activePlanning[anchor.roomName].plan;
          let xx: number[] = [];
          let yy: number[] = [];
          for (let x in plan)
            for (let y in plan[x])
              switch (plan[x][y].s) {
                case STRUCTURE_WALL:
                case STRUCTURE_RAMPART:
                case STRUCTURE_ROAD:
                case STRUCTURE_LINK:
                case STRUCTURE_CONTAINER:
                case STRUCTURE_EXTRACTOR:
                case STRUCTURE_OBSERVER:
                case STRUCTURE_WALL:
                case STRUCTURE_RAMPART:
                case undefined:
                case null:
                  break;
                default:
                  if (!xx.includes(+x))
                    xx.push(+x);
                  if (!yy.includes(+y))
                    yy.push(+y);
              }
          ranges.sort((a, b) => b - a);
          let terrain = Game.map.getRoomTerrain(anchor.roomName);

          let addedWalls: Pos[] = [];
          let minx = Math.max(Math.min(...xx) - range, 2);
          let maxx = Math.min(Math.max(...xx) + range, 47);
          let miny = Math.max(Math.min(...yy) - range, 2);
          let maxy = Math.min(Math.max(...yy) + range, 47);
          // console .log(range, ":", minx, maxx, miny, maxy);

          let color: { [id: string]: number } = {};
          let colorInterest: { [id: number]: 1 | 0 } = {};
          let colorCount = 1;
          let toCheck: string[] = [];

          for (let x = minx; x < maxx; ++x) {
            toCheck.push(x + "_" + miny);
            toCheck.push(x + "_" + maxy);
          }
          for (let y = miny; y < maxy; ++y) {
            toCheck.push(minx + "_" + y);
            toCheck.push(maxx + "_" + y);
          }
          while (toCheck.length) {
            let str = toCheck.pop()!;
            let pos = /^(\d*)_(\d*)/.exec(str)!;
            if (!color[str])
              if (terrain.get(+pos[1], +pos[2]) !== TERRAIN_MASK_WALL) {
                color[str] = colorCount++;
                colorInterest[color[str]] = 0;
              } else
                continue;
            for (let x = +pos[1] - 1; x <= +pos[1] + 1 && x <= 49; x++)
              for (let y = +pos[2] - 1; y <= +pos[2] + 1 && y <= 49; y++) {
                if (terrain.get(x, y) === TERRAIN_MASK_WALL)
                  continue;
                if (y <= maxy && y >= miny && x <= maxx && x >= minx)
                  continue;
                let str1 = x + "_" + y;
                if (!color[str1]) {
                  if (!toCheck.includes(str1) && x > 0 && y > 0 && x < 49 && y < 49)
                    toCheck.push(str1);
                  color[str1] = color[str];
                } else if (color[str1] !== color[str]) {
                  let state = <0 | 1>Math.max(colorInterest[color[str]], colorInterest[color[str1]]);
                  colorInterest[color[str]] = state;
                  colorInterest[color[str1]] = state;
                }

                if (x === 0 || y === 0 || x === 49 || y === 49)
                  colorInterest[color[str1]] = 1;
              }
          }

          /*
          Apiary.visuals.changeAnchor(0, 0, anchor.roomName);
          for (let x = 0; x <= 49; ++x)
            for (let y = 0; y <= 49; ++y)
              if (color[x + "_" + y])
                Apiary.visuals.anchor.vis.text("" + color[x + "_" + y], x, y);
          Apiary.visuals.exportAnchor(20);
          */

          let addWall = (x_x: number, y_y: number, rampart: boolean) => {
            if (!colorInterest[color[x_x + "_" + y_y]])
              return;
            let ans;
            if (rampart) {
              this.addToPlan({ x: x_x, y: y_y }, anchor.roomName, null);
              ans = this.addToPlan({ x: x_x, y: y_y }, anchor.roomName, STRUCTURE_RAMPART);
            } else
              ans = this.addToPlan({ x: x_x, y: y_y }, anchor.roomName, STRUCTURE_WALL);
            if (ans === OK)
              addedWalls.push({ x: x_x, y: y_y });
          };

          for (let x = minx; x <= maxx; ++x) {
            addWall(x, miny, ramparts && x % 3 === 0);
            addWall(x, maxy, ramparts && x % 3 === 0);
          }
          for (let y = miny; y <= maxy; ++y) {
            addWall(minx, y, ramparts && y % 3 === 0);
            addWall(maxx, y, ramparts && y % 3 === 0);
          }

          this.removeNonUsedWalls(anchor, addedWalls);
          return OK;
        }
      });
    });
    return OK;
  }

  removeNonUsedWalls(anchor: RoomPosition, addedWalls: Pos[]) {
    _.forEach(addedWalls, p => {
      let pos = new RoomPosition(p.x, p.y, anchor.roomName);
      let pathArgs = getPathArgs({
        costCallback: (roomName: string, costMatrix: CostMatrix) => {
          let plan = this.activePlanning[roomName].plan;
          for (let x in plan)
            for (let y in plan[x]) {
              if (plan[x][y].s === STRUCTURE_WALL)
                costMatrix.set(+x, +y, 255);
              else if (plan[x][y].r)
                costMatrix.set(+x, +y, 255);
            }
          return costMatrix;
        }
      });

      let path = anchor.findPathTo(pos, pathArgs);
      let newPos = path.length && new RoomPosition(path[path.length - 1].x, path[path.length - 1].y, anchor.roomName);
      while (newPos && (newPos.x !== pos.x || newPos.y !== pos.y)) {
        path = pos.findPathTo(pos, pathArgs);
        if (path.length > 0)
          newPos = new RoomPosition(path[path.length - 1].x, path[path.length - 1].y, anchor.roomName);
        else
          break;
      }

      let plan = this.activePlanning[anchor.roomName].plan;
      if (newPos && (p.x !== newPos.x || p.y !== newPos.y)) {
        if (plan[p.x] && plan[p.x][p.y] && plan[p.x][p.y].s === STRUCTURE_WALL)
          this.addToPlan({ x: p.x, y: p.y }, anchor.roomName, undefined, true);
        else if (plan[p.x] && plan[p.x][p.y])
          this.activePlanning[anchor.roomName].plan[p.x][p.y].r = false;
      }
    });
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

  connectWithRoad(anchor: RoomPosition, pos: RoomPosition, addRoads: boolean, opts: CoustomFindPathOpts = {}): Pos | ERR_BUSY | ERR_FULL {
    let roomName = anchor.roomName;
    if (!(pos.roomName in Game.rooms))
      return ERR_FULL;
    let exit: RoomPosition | undefined | null;
    let exits = this.activePlanning[roomName].exits;
    if (roomName !== pos.roomName)
      opts.maxRooms = 16;
    exit = pos.findClosestByPath(exits, getPathArgs(opts));
    if (!exit)
      exit = pos.findClosest(exits);
    if (!exit)
      return ERR_FULL;
    let path = exit.findPathTo(pos, getPathArgs(opts));
    if (!path.length)
      return exit.x === pos.x && exit.y === pos.y ? exit : ERR_FULL;

    let lastPath = path.pop()!;
    if (addRoads)
      _.forEach(path, pos => this.addToPlan(pos, exit!.roomName, STRUCTURE_ROAD));
    else
      _.forEach(path, pos => this.addToPlan(pos, exit!.roomName, null));

    // console. log(`${anchor} ->   ${exit}-${path.length}->${new RoomPosition(lastPath.x, lastPath.y, exit.roomName)}   -> ${pos}`);
    exit = new RoomPosition(lastPath.x, lastPath.y, exit.roomName);
    if (pos.x !== lastPath.x || pos.y !== lastPath.y || pos.roomName !== exit.roomName) {
      let ent = exit.getEnteranceToRoom();
      this.activePlanning[roomName].exits.push(ent ? ent : exit);
      return ERR_BUSY;
    }
    return path.length > 0 ? new RoomPosition(path[path.length - 1].x, path[path.length - 1].y, exit.roomName) : exit;
  }

  addToPlan(pos: Pos, roomName: string, sType: BuildableStructureConstant | null | undefined, force: boolean = false, check: boolean = false) {
    if (!this.activePlanning[roomName])
      this.initPlanning(roomName, new RoomPosition(pos.x, pos.y, roomName));
    if (Game.map.getRoomTerrain(roomName).get(pos.x, pos.y) === TERRAIN_MASK_WALL && sType !== STRUCTURE_EXTRACTOR)
      return ERR_NO_PATH;
    let placed = this.activePlanning[roomName].placed;
    let plan = this.activePlanning[roomName].plan;

    if (check && (!plan[pos.x] || !plan[pos.x][pos.y]))
      return OK;
    if (!plan[pos.x])
      plan[pos.x] = {};
    if (!plan[pos.x][pos.y])
      plan[pos.x][pos.y] = { s: undefined, r: false };
    let oldState = { s: plan[pos.x][pos.y].s, r: plan[pos.x][pos.y].r };
    if (sType === STRUCTURE_RAMPART)
      plan[pos.x][pos.y] = { s: plan[pos.x][pos.y].s, r: true };
    else if (sType === undefined && force) {
      if (plan[pos.x][pos.y].s)
        placed[plan[pos.x][pos.y].s!]!--;
      plan[pos.x][pos.y] = { s: undefined, r: false };
    } else if (plan[pos.x][pos.y].s === undefined) {
      if (sType) {
        if (placed[sType]! >= CONTROLLER_STRUCTURES[sType][8])
          return ERR_FULL;
        placed[sType]!++;
      }
      plan[pos.x][pos.y] = { s: sType, r: plan[pos.x][pos.y].r };
    } else if (plan[pos.x][pos.y].s === STRUCTURE_WALL && sType !== STRUCTURE_WALL)
      plan[pos.x][pos.y] = { s: sType, r: true };
    else if (sType === STRUCTURE_WALL && plan[pos.x][pos.y].s !== STRUCTURE_WALL)
      plan[pos.x][pos.y] = { s: plan[pos.x][pos.y].s, r: true };
    else if (force) {
      if (plan[pos.x][pos.y].s)
        placed[plan[pos.x][pos.y].s!]!--;
      plan[pos.x][pos.y] = { s: sType, r: plan[pos.x][pos.y].r };
      if (sType)
        placed[sType]!++;
    } else
      return ERR_NO_PATH;
    if (check)
      plan[pos.x][pos.y] = oldState;
    return OK;
  }

  addModule(anchor: { x: number, y: number, roomName: string }, configuration: Module, transformPos: (a: Pos) => Pos) {
    this.activePlanning[anchor.roomName].jobsToDo.push({
      context: "adding module",
      func: () => {
        this.activePlanning[anchor.roomName].freeSpaces = this.activePlanning[anchor.roomName].freeSpaces
          .concat(configuration.freeSpaces.map(p => transformPos(p)).filter(p => Game.map.getRoomTerrain(anchor.roomName).get(p.x, p.y) !== TERRAIN_MASK_WALL));

        this.activePlanning[anchor.roomName].exits = this.activePlanning[anchor.roomName].exits
          .concat(configuration.exits.map(p => {
            let ans = transformPos(p);
            return new RoomPosition(ans.x, ans.y, anchor.roomName);
          }).filter(p => Game.map.getRoomTerrain(anchor.roomName).get(p.x, p.y) !== TERRAIN_MASK_WALL));

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

  toActive(anchor: RoomPosition, roomName: string = anchor.roomName, ignore: BuildableStructureConstant[] = []) {
    this.initPlanning(roomName, anchor);
    this.activePlanning[roomName].exits.push(anchor);
    for (let t in Memory.cache.roomPlanner[roomName]) {
      let sType = <BuildableStructureConstant>t;
      if (ignore.indexOf(sType) !== -1)
        continue
      let poss = Memory.cache.roomPlanner[roomName][sType]!.pos;
      for (let i = 0; i < poss.length; ++i)
        this.addToPlan(poss[i], roomName, sType, true);
      if (!poss.length)
        delete Memory.cache.roomPlanner[roomName][sType];
    }

    if (Memory.cache.hives[roomName])
      for (let type in Memory.cache.hives[roomName].positions)
        this.activePlanning[roomName].poss[<keyof PossiblePositions>type] = Memory.cache.hives[roomName].positions[<keyof PossiblePositions>type]!;

  }

  resetPlanner(roomName: string, anchor: RoomPosition) {
    Memory.cache.roomPlanner[roomName] = {};
    this.currentToActive(roomName, anchor);
    this.saveActive(roomName);
    delete this.activePlanning[roomName];
  }

  currentToActive(roomName: string, anchor: RoomPosition) {
    this.initPlanning(roomName, anchor);
    _.forEach((<(Structure | ConstructionSite)[]>Game.rooms[roomName].find(FIND_STRUCTURES))
      .concat(Game.rooms[roomName].find(FIND_CONSTRUCTION_SITES)),
      s => {
        if (!(s.structureType in CONTROLLER_STRUCTURES))
          return;
        if (this.getCase(s).amount === 0)
          return;
        if (s.pos.getEnteranceToRoom())
          return;
        this.addToPlan(s.pos, s.pos.roomName, <BuildableStructureConstant>s.structureType);
      });
  }

  saveActive(roomName: string) {
    let active = this.activePlanning[roomName];
    if (!(active))
      return;
    Memory.cache.roomPlanner[roomName] = {};
    let myRoom = Game.rooms[roomName] && Game.rooms[roomName].controller && Game.rooms[roomName].controller!.my;
    for (let x in active.plan)
      for (let y in active.plan[+x]) {
        if (active.plan[+x][+y].s)
          this.addToCache({ x: +x, y: +y }, roomName, active.plan[+x][+y].s!);
        else if (active.plan[+x][+y].s === null && myRoom) {
          let s = new RoomPosition(+x, +y, roomName).lookFor(LOOK_STRUCTURES)[0];
          if (s && s.structureType !== STRUCTURE_RAMPART && s.structureType !== STRUCTURE_ROAD)
            s.destroy();
        }

        if (active.plan[+x][+y].r || ADD_RAMPART.includes(active.plan[+x][+y].s))
          this.addToCache({ x: +x, y: +y }, roomName, STRUCTURE_RAMPART);
      }

    let anchor = this.activePlanning[roomName].anchor;
    for (let t in Memory.cache.roomPlanner[roomName]) {
      let sType = <BuildableStructureConstant>t;
      let poss = Memory.cache.roomPlanner[roomName][sType]!.pos;
      let contr = Game.rooms[roomName] && Game.rooms[roomName].controller
      poss.sort((a, b) => {
        let ans = anchorDist(anchor, a, roomName) - anchorDist(anchor, b, roomName);
        if (sType === STRUCTURE_LINK && contr)
          if (anchorDist(contr.pos, a, roomName) <= 3)
            ans = -1;
          else if (anchorDist(contr.pos, b, roomName) <= 3)
            ans = 1;
        if (ans === 0)
          ans = anchorDist(anchor, a, roomName, true) - anchorDist(anchor, b, roomName, true);
        return ans; //* (sType === STRUCTURE_RAMPART || sType === STRUCTURE_WALL ? -1 : 1);
      });
      Memory.cache.roomPlanner[roomName][sType]!.pos = poss;
    }

    if (Memory.cache.hives[roomName])
      for (let type in this.activePlanning[roomName].poss)
        Memory.cache.hives[roomName].positions[<keyof PossiblePositions>type] = this.activePlanning[roomName].poss[<keyof PossiblePositions>type]!;
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
    let hitsMax = structure instanceof ConstructionSite ? structure.progressTotal : structure.hitsMax;
    let amount = CONTROLLER_STRUCTURES[<BuildableStructureConstant>structure.structureType][controller.level];
    switch (structure.structureType) {
      case STRUCTURE_RAMPART:
      case STRUCTURE_WALL:
        hitsMax = WALL_HEALTH;
        break;
      case STRUCTURE_CONTAINER:
        if (controller.level > 0 && controller.level < 3)
          amount = 0;
        break;
      default:
    }

    return { amount: amount ? amount : 0, heal: hitsMax };
  }

  checkBuildings(roomName: string, priorityQue: BuildableStructureConstant[], specials: { [key in StructureConstant]?: number } = {}, coef = 0.7, nukeAlert = false) {
    if (!(roomName in Game.rooms) || !Memory.cache.roomPlanner[roomName])
      return [];

    let contr = Game.rooms[roomName].controller
    let hive = Apiary.hives[roomName];
    let controller: StructureController | { level: number } | undefined = contr;
    if (!controller)
      controller = { level: 0 };

    let ans: BuildProject[] = [];
    let constructions = 0;
    let defenseIndex = Math.min(priorityQue.indexOf(STRUCTURE_RAMPART), priorityQue.indexOf(STRUCTURE_WALL));
    let firstDefense = defenseIndex > 0 ? priorityQue[defenseIndex] : "";
    for (let i = 0; i < priorityQue.length; ++i) {
      let sType = priorityQue[i];
      if (ans.length && sType === firstDefense)
        break;
      if (!(sType in Memory.cache.roomPlanner[roomName]))
        continue;
      let cc = this.getCase({ structureType: sType, pos: { roomName: roomName }, hitsMax: 0 });
      let toadd: RoomPosition[] = [];
      let placed = 0;
      let positions = Memory.cache.roomPlanner[roomName][sType]!.pos;
      for (let i = 0; i < positions.length; ++i) {
        let pos = new RoomPosition(positions[i].x, positions[i].y, roomName);
        let structure = <Structure<BuildableStructureConstant> | undefined>_.filter(pos.lookFor(LOOK_STRUCTURES),
          s => s.structureType === sType)[0];
        if (!structure) {
          let constructionSite = _.filter(pos.lookFor(LOOK_CONSTRUCTION_SITES), s => s.structureType === sType)[0];
          if (!constructionSite) {
            let place = _.filter(pos.lookFor(LOOK_STRUCTURES), s => s.structureType !== STRUCTURE_RAMPART)[0];
            if (place && sType !== STRUCTURE_RAMPART) {
              if (hive) {
                if (sType !== STRUCTURE_SPAWN || Object.keys(hive.cells.spawn).length > 1)
                  place.destroy();
              } else if (!place.pos.lookFor(LOOK_FLAGS).length)
                place.pos.createFlag("remove_" + makeId(4), COLOR_GREY, COLOR_RED);
            } else
              toadd.push(pos);
          } else if (constructionSite.structureType === sType) {
            switch (sType) {
              case STRUCTURE_RAMPART:
              case STRUCTURE_WALL:
                let heal = this.getCase(constructionSite).heal;
                if (sType in specials)
                  heal = specials[sType]!;
                ans.push({
                  pos: pos,
                  sType: sType,
                  targetHits: heal,
                  energyCost: Math.ceil(heal / 100),
                  type: "repair",
                });
              default:
                ans.push({
                  pos: pos,
                  sType: sType,
                  targetHits: 0,
                  energyCost: constructionSite.progressTotal - constructionSite.progress,
                  type: "construction",
                });
                ++constructions;
            }
          } else if (constructionSite.my && constructionSite.structureType !== STRUCTURE_RAMPART && sType !== STRUCTURE_RAMPART)
            constructionSite.remove();
        } else if (structure) {
          placed++;
          let heal = this.getCase(structure).heal;
          if (sType in specials)
            heal = specials[sType]!;
          if (structure.hits < heal * 0.25
            || (structure.hits < heal * coef && !constructions)
            || (sType === STRUCTURE_RAMPART && structure.hits < Math.max(heal - 50000, heal * coef))
            || (sType === STRUCTURE_WALL && structure.hits < Math.max(heal - 5000, heal * coef)))
            ans.push({
              pos: pos,
              sType: sType,
              targetHits: heal,
              energyCost: Math.ceil((heal - structure.hits) / 100),
              type: "repair",
            });
        }
      }
      /*
      if (ans.length || toadd.length)
        console .log(`${roomName} ${sType} : ${ans.length}/(${constructions}+${toadd.length}) : ${_.sum(ans, e => e.targetHits / 100)}/${_.sum(ans, e => e.energyCost)}`);
      */
      if (!constructions)
        for (let i = 0; i < toadd.length && i < cc.amount - placed && constructions < CONSTRUCTIONS_PER_TYPE; ++i) {
          let anss;
          if (!nukeAlert || !toadd[i].findInRange(FIND_NUKES, 2).length)
            if (sType === STRUCTURE_SPAWN)
              anss = toadd[i].createConstructionSite(sType, roomName.toLowerCase() + makeId(4));
            else
              anss = toadd[i].createConstructionSite(sType);
          if (anss === OK) {
            switch (sType) {
              case STRUCTURE_RAMPART:
              case STRUCTURE_WALL:
                let heal = this.getCase({ structureType: sType, pos: toadd[i], hitsMax: WALL_HITS_MAX }).heal;
                if (sType in specials)
                  heal = specials[sType]!;
                ans.push({
                  pos: toadd[i],
                  sType: sType,
                  targetHits: heal,
                  energyCost: Math.ceil(heal / 100),
                  type: "repair",
                });
              default:
                ans.push({
                  pos: toadd[i],
                  sType: sType,
                  targetHits: 0,
                  energyCost: CONSTRUCTION_COST[sType],
                  type: "construction",
                });
                ++constructions;
            }
          }
        }
    }

    return ans;
  }
}
