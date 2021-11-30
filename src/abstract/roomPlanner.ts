import { makeId, getEnterances } from "./utils";
import { roomStates } from "../enums";

import { profile } from "../profiler/decorator";
import { Traveler } from "../Traveler/TravelerModified";

import type { PossiblePositions, BuildProject } from "../Hive";

export type RoomSetup = { [key in BuildableStructureConstant]?: { pos: { x: number, y: number }[] } };

type Module = { setup: RoomSetup, freeSpaces: Pos[], exits: Pos[], poss: PossiblePositions };
type BlockDirections = TOP | RIGHT | TOP_RIGHT | TOP_LEFT;

// well i can add more
const BASE: Module = { poss: { center: { x: 25, y: 25 }, lab: { x: 20, y: 26 }, queen1: { x: 25, y: 25 } }, exits: [], freeSpaces: [{ x: 30, y: 26 }, { x: 30, y: 24 }, { x: 31, y: 25 }, { x: 28, y: 24 }, { x: 28, y: 23 }, { x: 29, y: 23 }, { x: 28, y: 26 }, { x: 29, y: 27 }, { x: 28, y: 27 }, { x: 27, y: 27 }, { x: 29, y: 22 }, { x: 23, y: 26 }, { x: 22, y: 26 }, { x: 24, y: 27 }, { x: 20, y: 24 }, { x: 20, y: 26 }, { x: 19, y: 25 }, { x: 19, y: 23 }, { x: 18, y: 24 }, { x: 18, y: 26 }, { x: 19, y: 27 }, { x: 18, y: 27 }, { x: 18, y: 23 }, { x: 28, y: 21 }, { x: 27, y: 21 }, { x: 26, y: 22 }, { x: 29, y: 20 }, { x: 28, y: 20 }, { x: 30, y: 21 }, { x: 30, y: 22 }, { x: 30, y: 20 }, { x: 31, y: 23 }, { x: 31, y: 22 }, { x: 32, y: 24 }, { x: 32, y: 23 }, { x: 32, y: 26 }, { x: 32, y: 27 }, { x: 31, y: 27 }, { x: 30, y: 28 }, { x: 31, y: 28 }, { x: 29, y: 28 }, { x: 33, y: 24 }, { x: 33, y: 25 }, { x: 33, y: 26 }, { x: 25, y: 20 }, { x: 24, y: 22 }, { x: 17, y: 25 }, { x: 17, y: 26 }, { x: 17, y: 24 }, { x: 21, y: 27 }, { x: 22, y: 27 }, { x: 23, y: 27 }, { x: 19, y: 22 }, { x: 20, y: 28 }, { x: 19, y: 28 }, { x: 25, y: 28 }, { x: 26, y: 28 }, { x: 27, y: 28 }, { x: 22, y: 28 }, { x: 23, y: 28 }, { x: 21, y: 29 }, { x: 20, y: 29 }, { x: 24, y: 29 }, { x: 25, y: 29 }, { x: 22, y: 24 }, { x: 25, y: 26 }, { x: 25, y: 21 }, { x: 26, y: 20 }, { x: 24, y: 20 }, { x: 30, y: 25 }, { x: 27, y: 22 }, { x: 20, y: 25 }, { x: 22, y: 30 }, { x: 23, y: 30 }, { x: 24, y: 30 }, { x: 21, y: 30 }, { x: 18, y: 28 }, { x: 19, y: 29 }, { x: 20, y: 30 }, { x: 25, y: 30 }, { x: 26, y: 29 }, { x: 31, y: 21 }, { x: 32, y: 22 }, { x: 33, y: 23 }, { x: 33, y: 27 }, { x: 32, y: 28 }, { x: 28, y: 28 }, { x: 29, y: 29 }, { x: 30, y: 29 }, { x: 31, y: 29 }, { x: 18, y: 22 }, { x: 17, y: 23 }, { x: 17, y: 27 }], setup: { road: { pos: [{ x: 19, y: 24 }, { x: 21, y: 24 }, { x: 20, y: 23 }, { x: 20, y: 13 }, { x: 25, y: 22 }, { x: 21, y: 21 }, { x: 18, y: 25 }, { x: 19, y: 26 }, { x: 21, y: 26 }, { x: 22, y: 22 }, { x: 20, y: 27 }, { x: 27, y: 23 }, { x: 27, y: 24 }, { x: 27, y: 26 }, { x: 28, y: 25 }, { x: 29, y: 21 }, { x: 29, y: 24 }, { x: 29, y: 26 }, { x: 30, y: 27 }, { x: 30, y: 23 }, { x: 31, y: 26 }, { x: 31, y: 24 }, { x: 22, y: 25 }, { x: 24, y: 26 }, { x: 23, y: 25 }, { x: 26, y: 27 }, { x: 26, y: 23 }, { x: 24, y: 23 }, { x: 23, y: 24 }, { x: 23, y: 23 }, { x: 25, y: 25 }, { x: 26, y: 24 }, { x: 32, y: 25 }, { x: 28, y: 22 }, { x: 25, y: 27 }, { x: 21, y: 28 }, { x: 22, y: 29 }, { x: 23, y: 29 }, { x: 24, y: 28 }, { x: 26, y: 21 }, { x: 27, y: 20 }, { x: 24, y: 21 }, { x: 23, y: 20 }] }, container: { pos: [] }, spawn: { pos: [{ x: 21, y: 25 }, { x: 29, y: 25 }, { x: 25, y: 23 }] }, storage: { pos: [{ x: 24, y: 24 }] }, terminal: { pos: [{ x: 24, y: 25 }] }, lab: { pos: [{ x: 23, y: 22 }, { x: 23, y: 21 }, { x: 22, y: 21 }, { x: 22, y: 20 }, { x: 21, y: 20 }, { x: 20, y: 21 }, { x: 20, y: 22 }, { x: 21, y: 22 }, { x: 21, y: 23 }, { x: 22, y: 23 }] }, factory: { pos: [{ x: 26, y: 26 }] }, observer: { pos: [] }, powerSpawn: { pos: [{ x: 26, y: 25 }] }, link: { pos: [{ x: 25, y: 24 }] }, nuker: { pos: [{ x: 27, y: 25 }] } } };



// box of 12 x 11 spawns at dist 1 from center except the opposite of biggest side

const CONSTRUCTIONS_PER_TYPE = 5;

export const WALL_HEALTH = 10000;

// oh no i need to def
const ADD_RAMPART: (BuildableStructureConstant | undefined | null)[] = []//STRUCTURE_TOWER, STRUCTURE_SPAWN, STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_LAB, STRUCTURE_FACTORY, STRUCTURE_NUKER, STRUCTURE_POWER_SPAWN]; // STRUCTURE_LINK

type Job = { func: () => OK | ERR_BUSY | ERR_FULL, context: string };
interface CoustomFindPathOpts extends TravelToOptions { ignoreTypes?: BuildableStructureConstant[] };
function getPathArgs(opt: CoustomFindPathOpts = {}): TravelToOptions {
  return _.defaults(opt, {
    ignoreStructures: true, offRoad: true, maxRooms: 4, range: 0, weightOffRoad: 2,
    roomCallback: function(roomName: string, costMatrix: CostMatrix): CostMatrix | void {
      if (!Apiary.planner.activePlanning[roomName])
        return;
      let plan = Apiary.planner.activePlanning[roomName].plan;
      for (let x in plan)
        for (let y in plan[x]) {
          let sType = plan[x][y].s
          if (sType && (!opt.ignoreTypes || !opt.ignoreTypes.includes(sType)))
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
  return anchor.getRangeApprox(new RoomPosition(x.x, x.y, roomName));
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
        jobs.shift()!;
        if (Game.cpu.getUsed() >= Game.cpu.limit * 0.9) {
          console.log(`Planner for ${roomName}: ${jobs.length} left`);
          return;
        }
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

  generatePlan(anchor: RoomPosition, rotation: ExitConstant) {
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

    let order: ExitConstant[] = [1, 5, 3, 7];
    order.splice(order.indexOf(rotation), 1);

    this.addModule(anchor, BASE, a => rotate(a, rotationBase[rotation]));

    let customRoads = _.filter(Game.flags, f => f.color === COLOR_WHITE && f.secondaryColor === COLOR_PURPLE);
    customRoads.sort((a, b) => {
      let ans = anchor.getRoomRangeTo(a) - anchor.getRoomRangeTo(b);
      if (ans === 0)
        return anchor.getTimeForPath(a) - anchor.getTimeForPath(b);
      return ans;
    });

    let customBuildings = _.filter(Game.flags, f => f.color === COLOR_WHITE && f.secondaryColor === COLOR_RED);
    _.forEach(customBuildings, f => (f.name in CONSTRUCTION_COST) && this.addToPlan(f.pos, f.pos.roomName, <BuildableStructureConstant>f.name), true);

    _.forEach(customRoads, f => this.addCustomRoad(anchor, f.pos));

    this.addResourceRoads(anchor);

    this.addUpgradeSite(anchor);

    let enterances = this.protectPoint(anchor);
    let enterance = anchor.findClosestByTravel(enterances, getPathArgs());

    let fillTypes = [STRUCTURE_TOWER, STRUCTURE_EXTENSION, STRUCTURE_POWER_SPAWN, STRUCTURE_FACTORY, STRUCTURE_OBSERVER];

    for (let i in fillTypes) {
      let sType = fillTypes[i];
      jobs.push({
        context: `placing ${sType}`,
        func: () => {
          let free = this.activePlanning[anchor.roomName].freeSpaces;
          if (this.activePlanning[anchor.roomName].placed[sType]!! < CONTROLLER_STRUCTURES[sType][8]) {
            let anchorrr = anchor;
            if (sType === STRUCTURE_TOWER && enterance)
              anchorrr = enterance;
            let red = ((a: Pos, b: Pos) => {
              if (sType === STRUCTURE_EXTENSION && anchorDist(anchorrr, b) <= 1)
                return a;
              let ans = 0;
              let pathA = Traveler.findTravelPath(new RoomPosition(a.x, a.y, anchorrr.roomName), anchorrr, getPathArgs()).path;
              if (!pathA.length || !pathA[pathA.length - 1].equal(anchorrr))
                ans = 1;
              let pathB = Traveler.findTravelPath(new RoomPosition(b.x, b.y, anchorrr.roomName), anchorrr, getPathArgs()).path;
              if (!pathB.length || !pathB[pathB.length - 1].equal(anchorrr))
                ans = -1;
              if (ans === 0)
                ans = pathA.length - pathB.length;
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
  }

  protectPoint(anchor: RoomPosition) {
    if (!this.activePlanning[anchor.roomName])
      this.toActive(anchor, undefined, [STRUCTURE_WALL, STRUCTURE_RAMPART]);

    let enterances = getEnterances(anchor.roomName)
    _.forEach(enterances, e => {
      this.activePlanning[anchor.roomName].jobsToDo.push({
        context: `blocking off ${e}`,
        func: () => this.exludePoint(anchor, e),
      });
    });
    return enterances;
  }

  exludePoint(anchor: RoomPosition, pos: RoomPosition, minDist: number = 6, removeNonUsed = true) {
    // not optimal, but good enough (can first block small gap, and than douple close a big one around)
    let pathArgs = getPathArgs({
      offRoad: true,
      maxRooms: 1,
      roomCallback: (roomName: string, costMatrix: CostMatrix) => {
        if (!this.activePlanning[roomName])
          return;
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
    let path = Traveler.findTravelPath(anchor, pos, pathArgs).path;
    let costOfBlocking: {
      pos: RoomPosition,
      costs: { [key in BlockDirections]: { pos: Pos[], amount: number } }
    }[] = [];
    let addedWalls: Pos[] = [];
    let min = Infinity;
    while (path.length && path[path.length - 1].equal(pos)) {
      for (let i = 0; i < path.length; ++i) {
        let p = path[i];
        let curr = {
          pos: p,
          costs: {
            [TOP]: this.toBlock(p, TOP, min),
            [RIGHT]: this.toBlock(p, RIGHT, min),
            [TOP_RIGHT]: this.toBlock(p, TOP_RIGHT, min),
            [TOP_LEFT]: this.toBlock(p, TOP_LEFT, min),
          }
        };

        if (i >= 15)
          _.forEach(curr.costs, c => {
            c.amount += 10;
          });

        let currMin = _.min(curr.costs, c => c.amount).amount;
        if (min >= currMin) {
          costOfBlocking.push(curr);
          min = currMin;
        }
      }

      // console .log(pos, _.map(costOfBlocking, c => [c.pos, anchor.getRangeTo(c), c.costs[TOP_LEFT].amount]))
      if (!costOfBlocking.length)
        break;
      let toBlock = costOfBlocking.reduce((prev, curr) => {
        let ans = 0;
        let prevRange = anchor.getRangeTo(prev);
        let currRange = anchor.getRangeTo(curr);
        if (prevRange <= minDist)
          ans = -1;
        if (currRange <= minDist)
          ans = 1;
        if (ans === 0)
          ans = _.min(curr.costs, c => c.amount).amount - _.min(prev.costs, c => c.amount).amount;
        if (ans === 0) {
          ans = currRange - prevRange;
          if (prevRange <= 10 && currRange <= 10)
            ans *= -1;
        }
        return ans < 0 ? curr : prev;
      });

      let mode: BlockDirections = TOP;
      for (const mm in toBlock.costs) {
        if (toBlock.costs[<BlockDirections>+mm].amount < toBlock.costs[mode].amount)
          mode = <BlockDirections>+mm;
      }
      this.connectWithRoad(anchor, toBlock.pos, false);
      _.forEach(toBlock.costs[mode].pos, p => {
        this.addToPlan(p, anchor.roomName, STRUCTURE_RAMPART);
        addedWalls.push(p);
      });
      costOfBlocking = [];
      path = Traveler.findTravelPath(anchor, pos, pathArgs).path;
    }
    if (removeNonUsed)
      this.activePlanning[pos.roomName].jobsToDo.push({
        context: `removing non used walls for ${pos}`,
        func: () => {
          this.removeNonUsedWalls(pos, addedWalls);
          this.removeNonUsedWalls(anchor, addedWalls);
          /*this.activePlanning[pos.roomName].jobsToDo.push({
            context: `thick walls for ${pos}`,
            func: () => this.thickWalls(anchor, addedWalls),
          });*/
          return OK;
        },
      });
    return OK;
  }

  /* i don't see a usecase for thickwalls (mostly)
  thickWalls(anchor: RoomPosition, poss: Pos[]): OK {
    _.forEach(poss, p => {
      let plan = this.activePlanning[anchor.roomName].plan;
      let type = plan[p.x] && plan[p.x][p.y];
      if (type && (type.r || type.s === STRUCTURE_WALL)) {
        let y = p.y;
        for (let x = p.x - 1; x < p.x + 1; x += 1)
          if (x > 1 && x < 48 && y > 1 && y < 48) {
            let type = plan[x] && plan[x][y];
            if (!type || !(type.r || type.s === STRUCTURE_WALL)) {
              this.addToPlan({ x: x, y: y }, anchor.roomName, STRUCTURE_RAMPART);
            }
          }
        let x = p.x;
        for (let y = p.y - 1; y < p.y + 1; y += 1)
          if (x > 1 && x < 48 && y > 1 && y < 48) {
            let type = plan[x] && plan[x][y];
            if (!type || !(type.r || type.s === STRUCTURE_WALL)) {
              this.addToPlan({ x: x, y: y }, anchor.roomName, STRUCTURE_RAMPART);
            }
          }
      }
    });

    return OK;
  }*/

  toBlock(pos: RoomPosition, mode: BlockDirections, stopAmount = Infinity): { pos: Pos[], amount: number } {
    let plan = this.activePlanning[pos.roomName].plan;
    let terrain = Game.map.getRoomTerrain(pos.roomName);
    let ans: Pos[] = [pos];
    let x = pos.x;
    let y = pos.y;
    let amount = pos.getOpenPositions(true).filter(p => p.getEnteranceToRoom()).length ? Infinity : 0;
    let nearEnterance = (x1: number, y1: number) =>
      (x1 === 1 || x1 === 48 || y1 === 1 || y1 === 48) &&
      new RoomPosition(x1, y1, pos.roomName).getPositionsInRange(1)
        .filter(p => terrain.get(p.x, p.y) !== TERRAIN_MASK_WALL && p.getEnteranceToRoom()).length;
    let checkEndOfRoom = (x1: number, y1: number) => {
      if (x1 <= 0 || x1 >= 49 || y1 <= 0 || y1 >= 49 || nearEnterance(x1, y1))
        amount = Infinity;
    }
    let shouldStop = (x1: number, y1: number) =>
      terrain.get(x1, y1) === TERRAIN_MASK_WALL
      || ans.length > stopAmount
      || (plan[x1] && plan[x1][y1] && (plan[x1][y1].s === STRUCTURE_WALL || plan[x1][y1].r))
      || nearEnterance(x1, y1);

    switch (mode) {
      case TOP:
        for (x = pos.x + 1; x < 49; ++x) {
          if (shouldStop(x, y))
            break;
          ans.push({ x: x, y: y });
        }
        checkEndOfRoom(x, y);

        for (x = pos.x - 1; x > 0; --x) {
          if (shouldStop(x, y))
            break;
          ans.push({ x: x, y: y });
        }
        checkEndOfRoom(x, y);
        break;
      case RIGHT:
        for (y = pos.y + 1; y < 49; ++y) {
          if (shouldStop(x, y))
            break;
          ans.push({ x: pos.x, y: y });
        }
        checkEndOfRoom(x, y);

        for (y = pos.y - 1; y > 0; --y) {
          if (shouldStop(x, y))
            break;
          ans.push({ x: x, y: y });
        }
        checkEndOfRoom(x, y);
        break;

      case TOP_LEFT:
        y = pos.y;
        x = pos.x + 1;
        while (x < 49 && y < 49) {
          if (shouldStop(x, y))
            break;
          ans.push({ x: x, y: y });
          if ((x + y) % 2 === (pos.x + pos.y) % 2)
            ++x;
          else
            ++y;
        }
        checkEndOfRoom(x, y);

        y = pos.y - 1;
        x = pos.x;
        while (x > 0 && y > 0) {
          if (shouldStop(x, y))
            break;
          ans.push({ x: x, y: y });
          if ((x + y) % 2 === (pos.x + pos.y) % 2)
            --y;
          else
            --x;
        }
        checkEndOfRoom(x, y);
        break;
      case TOP_RIGHT:
        y = pos.y;
        x = pos.x + 1;
        while (x < 49 && y > 0) {
          if (shouldStop(x, y))
            break;
          ans.push({ x: x, y: y });
          if ((x + y % 2) === (pos.x + pos.y % 2))
            ++x;
          else
            --y;
        }
        checkEndOfRoom(x, y);

        y = pos.y + 1;
        x = pos.x;
        while (x > 0 && y < 49) {
          if (shouldStop(x, y))
            break;
          ans.push({ x: x, y: y });
          if ((x + y) % 2 === (pos.x + pos.y) % 2)
            ++y;
          else
            --x;
        }
        checkEndOfRoom(x, y);
        break;
    }

    if (ans.length > stopAmount)
      amount = Infinity;

    return { pos: ans, amount: amount || ans.length };
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

  addUpgradeSite(anchor: RoomPosition) {
    if (!this.activePlanning[anchor.roomName])
      this.toActive(anchor);

    this.activePlanning[anchor.roomName].jobsToDo.push({
      context: "upgrade site",
      func: () => {
        if (!(anchor.roomName in Game.rooms))
          return ERR_FULL;
        let contr = Game.rooms[anchor.roomName].controller;
        if (contr) {
          let ans = this.connectWithRoad(anchor, contr.pos, false, { range: 1, maxRooms: 1 });
          if (typeof ans === "number")
            return ans;
          let poss = contr.pos.getPositionsInRange(1);
          _.forEach(poss, p => this.addToPlan(p, anchor.roomName, STRUCTURE_WALL));
          poss = contr.pos.getPositionsInRange(3);
          let plan = this.activePlanning[anchor.roomName].plan;
          let pp = poss.filter(p => plan[p.x] && plan[p.x][p.y] && plan[p.x][p.y].s === STRUCTURE_LINK)[0];
          if (pp || !poss.length)
            return OK;
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
          let ans = this.connectWithRoad(anchor, f.pos, true, { range: 1 });
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
            if (pos)
              return OK;
            pos = poss.reduce((prev, curr) => {
              if (this.addToPlan(prev, anchor.roomName, STRUCTURE_LINK, false, true) !== OK
                || this.addToPlan(curr, anchor.roomName, STRUCTURE_LINK, false, true) === OK && anchor.getRangeTo(prev) > anchor.getRangeTo(curr))
                return curr;
              return prev;
            });
            if (this.addToPlan(pos, anchor.roomName, STRUCTURE_LINK) !== OK)
              return ERR_FULL;
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

  removeNonUsedWalls(anchor: RoomPosition, addedWalls: Pos[]) {
    _.forEach(addedWalls, p => {
      let pos = new RoomPosition(p.x, p.y, anchor.roomName);
      if (pos.getOpenPositions(true).filter(p => p.getEnteranceToRoom()).length)
        return;
      let pathArgs = getPathArgs({
        offRoad: true,
        maxRooms: 1,
        roomCallback: (roomName: string, costMatrix: CostMatrix) => {
          if (!this.activePlanning[roomName])
            return;
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

      let plan = this.activePlanning[anchor.roomName].plan;
      let type = plan[p.x] && plan[p.x][p.y];
      if (type && !(type.r || type.s === STRUCTURE_WALL))
        return;

      let path = Traveler.findTravelPath(pos, anchor, pathArgs).path;
      let newPos = path.pop();
      let oldPos = anchor;
      while (newPos && !newPos.equal(anchor) && !oldPos.equal(newPos)) {
        path = Traveler.findTravelPath(pos, anchor, pathArgs).path;
        oldPos = newPos;
        newPos = path.pop();
      }

      if (newPos && !newPos.equal(anchor)) {
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

  connectWithRoad(anchor: RoomPosition, pos: RoomPosition, addRoads: boolean, opt: CoustomFindPathOpts = {}): Pos | ERR_BUSY | ERR_FULL {
    let roomName = anchor.roomName;
    let exit: RoomPosition | undefined | null;
    let exits = this.activePlanning[roomName].exits;
    if (roomName !== pos.roomName)
      opt.maxRooms = 16;
    opt = getPathArgs(opt);
    exit = pos.findClosestByTravel(exits, opt);
    if (!exit)
      exit = pos.findClosest(exits);
    if (!exit)
      return ERR_FULL;
    let path = Traveler.findTravelPath(exit, pos, getPathArgs(opt)).path;
    if (!path.length)
      return exit.getRangeTo(pos) > opt.range! ? exit : ERR_FULL;

    _.forEach(path.filter(p => !p.getEnteranceToRoom()), p => this.addToPlan(p, p.roomName, addRoads ? STRUCTURE_ROAD : null));

    // console. log(`${anchor} ->   ${exit}-${path.length}->${new RoomPosition(lastPath.x, lastPath.y, exit.roomName)}   -> ${pos}`);
    exit = path[path.length - 1];
    if (exit.getRangeTo(pos) > opt.range!) {
      let ent = exit.getEnteranceToRoom();
      this.activePlanning[roomName].exits.push(ent ? ent : exit);
      return ERR_BUSY;
    }
    return path[path.length - 1];
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
            if (this.addToPlan(ans, anchor.roomName, sType) === ERR_FULL && sType !== STRUCTURE_LAB)
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
      .concat(Game.rooms[roomName].find(FIND_CONSTRUCTION_SITES).filter(c => c.my)),
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
      let contr = Game.rooms[roomName] && Game.rooms[roomName].controller;
      let terrain = Game.map.getRoomTerrain(roomName);
      let posWeighted = poss.map(pos => { return { pos: pos, dist: anchorDist(anchor, pos, roomName, true) } })
      posWeighted.sort((a, b) => {
        let ans = a.dist - a.dist;
        if (sType === STRUCTURE_LINK && contr)
          if (a.dist <= 3)
            ans = -1;
          else if (a.dist <= 3)
            ans = 1;
        if (ans === 0)
          ans = terrain.get(a.pos.x, a.pos.y) - terrain.get(b.pos.x, b.pos.y)
        return ans; //* (sType === STRUCTURE_RAMPART || sType === STRUCTURE_WALL ? -1 : 1);
      });
      Memory.cache.roomPlanner[roomName][sType]!.pos = posWeighted.map(p => p.pos);
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
    let perType = CONTROLLER_STRUCTURES[<BuildableStructureConstant>structure.structureType];
    if (!perType)
      return { amount: 0, heal: 0 };
    let amount = perType[controller.level];
    switch (structure.structureType) {
      case STRUCTURE_RAMPART:
      case STRUCTURE_WALL:
        hitsMax = WALL_HEALTH;
        if (controller.level < 3)
          amount = 0;
        break;
      case STRUCTURE_ROAD:
      case STRUCTURE_CONTAINER:
        if (controller.level > 0 && controller.level < 3)
          amount = 0;
        break;
      default:
    }

    return { amount: amount ? amount : 0, heal: hitsMax };
  }

  checkBuildings(roomName: string, priorityQue: BuildableStructureConstant[], nukeAlert: boolean, specials: { [key in StructureConstant]?: number } = {}, coef = 0.7) {
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
            let place = _.filter(pos.lookFor(LOOK_STRUCTURES), s => s.structureType !== STRUCTURE_RAMPART || !(<StructureRampart>s).my)[0];
            if (place && sType !== STRUCTURE_RAMPART) {
              if (hive) {
                if (sType !== STRUCTURE_SPAWN || Object.keys(hive.cells.spawn).length > 1)
                  place.destroy();
              } else if (!place.pos.lookFor(LOOK_FLAGS).filter(f => f.color === COLOR_GREY && f.secondaryColor === COLOR_RED).length)
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
          if (structure.hits < heal * coef)
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
