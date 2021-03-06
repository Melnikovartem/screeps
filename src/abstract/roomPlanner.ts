import { makeId, getEnterances } from "./utils";
import { roomStates, prefix } from "../enums";

import { profile } from "../profiler/decorator";
import { Traveler } from "../Traveler/TravelerModified";
import { BASE_MODE_HIVE } from "./hiveMemory";

import type { BuildProject } from "../Hive";

export type RoomSetup = { [key in BuildableStructureConstant | "null"]?: { pos: { x: number, y: number }[] } };
type CellCache = { poss: Pos };

type Module = { cellsCache: { [id: string]: CellCache }, setup: RoomSetup, freeSpaces: Pos[] };

// well i can add more
/* const BASE: Module = { poss: { center: { x: 25, y: 25 }, lab: { x: 20, y: 26 }, queen1: { x: 25, y: 25 } }, exits: [], freeSpaces: [{ x: 30, y: 26 }, { x: 30, y: 24 }, { x: 31, y: 25 }, { x: 28, y: 24 }, { x: 28, y: 23 }, { x: 29, y: 23 }, { x: 28, y: 26 }, { x: 29, y: 27 }, { x: 28, y: 27 }, { x: 27, y: 27 }, { x: 29, y: 22 }, { x: 23, y: 26 }, { x: 22, y: 26 }, { x: 24, y: 27 }, { x: 20, y: 24 }, { x: 20, y: 26 }, { x: 19, y: 25 }, { x: 19, y: 23 }, { x: 18, y: 24 }, { x: 18, y: 26 }, { x: 19, y: 27 }, { x: 18, y: 27 }, { x: 18, y: 23 }, { x: 28, y: 21 }, { x: 27, y: 21 }, { x: 26, y: 22 }, { x: 29, y: 20 }, { x: 28, y: 20 }, { x: 30, y: 21 }, { x: 30, y: 22 }, { x: 30, y: 20 }, { x: 31, y: 23 }, { x: 31, y: 22 }, { x: 32, y: 24 }, { x: 32, y: 23 }, { x: 32, y: 26 }, { x: 32, y: 27 }, { x: 31, y: 27 }, { x: 30, y: 28 }, { x: 31, y: 28 }, { x: 29, y: 28 }, { x: 33, y: 24 }, { x: 33, y: 25 }, { x: 33, y: 26 }, { x: 25, y: 20 }, { x: 24, y: 22 }, { x: 17, y: 25 }, { x: 17, y: 26 }, { x: 17, y: 24 }, { x: 21, y: 27 }, { x: 22, y: 27 }, { x: 23, y: 27 }, { x: 19, y: 22 }, { x: 20, y: 28 }, { x: 19, y: 28 }, { x: 25, y: 28 }, { x: 26, y: 28 }, { x: 27, y: 28 }, { x: 22, y: 28 }, { x: 23, y: 28 }, { x: 21, y: 29 }, { x: 20, y: 29 }, { x: 24, y: 29 }, { x: 25, y: 29 }, { x: 22, y: 24 }, { x: 25, y: 26 }, { x: 25, y: 21 }, { x: 26, y: 20 }, { x: 24, y: 20 }, { x: 30, y: 25 }, { x: 27, y: 22 }, { x: 20, y: 25 }, { x: 22, y: 30 }, { x: 23, y: 30 }, { x: 24, y: 30 }, { x: 21, y: 30 }, { x: 18, y: 28 }, { x: 19, y: 29 }, { x: 20, y: 30 }, { x: 25, y: 30 }, { x: 26, y: 29 }, { x: 31, y: 21 }, { x: 32, y: 22 }, { x: 33, y: 23 }, { x: 33, y: 27 }, { x: 32, y: 28 }, { x: 28, y: 28 }, { x: 29, y: 29 }, { x: 30, y: 29 }, { x: 31, y: 29 }, { x: 18, y: 22 }, { x: 17, y: 23 }, { x: 17, y: 27 }], setup: { road: { pos: [{ x: 19, y: 24 }, { x: 21, y: 24 }, { x: 20, y: 23 }, { x: 20, y: 13 }, { x: 25, y: 22 }, { x: 21, y: 21 }, { x: 18, y: 25 }, { x: 19, y: 26 }, { x: 21, y: 26 }, { x: 22, y: 22 }, { x: 20, y: 27 }, { x: 27, y: 23 }, { x: 27, y: 24 }, { x: 27, y: 26 }, { x: 28, y: 25 }, { x: 29, y: 21 }, { x: 29, y: 24 }, { x: 29, y: 26 }, { x: 30, y: 27 }, { x: 30, y: 23 }, { x: 31, y: 26 }, { x: 31, y: 24 }, { x: 22, y: 25 }, { x: 24, y: 26 }, { x: 23, y: 25 }, { x: 26, y: 27 }, { x: 26, y: 23 }, { x: 24, y: 23 }, { x: 23, y: 24 }, { x: 23, y: 23 }, { x: 25, y: 25 }, { x: 26, y: 24 }, { x: 32, y: 25 }, { x: 28, y: 22 }, { x: 25, y: 27 }, { x: 21, y: 28 }, { x: 22, y: 29 }, { x: 23, y: 29 }, { x: 24, y: 28 }, { x: 26, y: 21 }, { x: 27, y: 20 }, { x: 24, y: 21 }, { x: 23, y: 20 }] }, container: { pos: [] }, spawn: { pos: [{ x: 21, y: 25 }, { x: 29, y: 25 }, { x: 25, y: 23 }] }, storage: { pos: [{ x: 24, y: 24 }] }, terminal: { pos: [{ x: 24, y: 25 }] }, lab: { pos: [{ x: 23, y: 22 }, { x: 23, y: 21 }, { x: 22, y: 21 }, { x: 22, y: 20 }, { x: 21, y: 20 }, { x: 20, y: 21 }, { x: 20, y: 22 }, { x: 21, y: 22 }, { x: 21, y: 23 }, { x: 22, y: 23 }] }, factory: { pos: [{ x: 26, y: 26 }] }, observer: { pos: [] }, powerSpawn: { pos: [{ x: 26, y: 25 }] }, link: { pos: [{ x: 25, y: 24 }] }, nuker: { pos: [{ x: 27, y: 25 }] } } }; */


const LABS: Module = { cellsCache: { [prefix.laboratoryCell]: { poss: { x: 25, y: 25 } } }, setup: { road: { pos: [{ x: 24, y: 24 }, { x: 25, y: 25 }, { x: 26, y: 26 }, { x: 27, y: 27 }] }, lab: { pos: [{ x: 25, y: 24 }, { x: 26, y: 24 }, { x: 26, y: 25 }, { x: 27, y: 25 }, { x: 27, y: 26 }, { x: 24, y: 25 }, { x: 24, y: 26 }, { x: 25, y: 26 }, { x: 25, y: 27 }, { x: 26, y: 27 }] } }, freeSpaces: [] };

const FAST_REFILL: Module = { cellsCache: { [prefix.fastRefillCell]: { poss: { x: 25, y: 25 } } }, setup: { null: { pos: [{ "x": 26, "y": 26 }, { "x": 24, "y": 26 }, { "x": 24, "y": 24 }, { "x": 26, "y": 24 }] }, link: { pos: [{ x: 25, y: 25 }] }, spawn: { pos: [{ x: 23, y: 24 }, { x: 27, y: 24 }, { x: 25, y: 27 }] }, container: { pos: [{ x: 27, y: 25 }, { x: 23, y: 25 }] }, extension: { pos: [{ x: 23, y: 26 }, { x: 23, y: 27 }, { x: 24, y: 27 }, { x: 23, y: 23 }, { x: 24, y: 23 }, { x: 24, y: 25 }, { x: 25, y: 23 }, { x: 26, y: 23 }, { x: 27, y: 23 }, { x: 26, y: 25 }, { x: 27, y: 27 }, { x: 26, y: 27 }, { x: 27, y: 26 }, { x: 25, y: 26 }, { x: 25, y: 24 }] } }, freeSpaces: [] };

const FREE_CELL: Module = { cellsCache: {}, setup: { road: { pos: [{ x: 25, y: 23 }, { x: 25, y: 27 }, { x: 24, y: 26 }, { x: 23, y: 25 }, { x: 24, y: 24 }, { x: 26, y: 24 }, { x: 27, y: 25 }, { x: 26, y: 26 }] } }, freeSpaces: [{ x: 25, y: 24 }, { x: 25, y: 25 }, { x: 25, y: 26 }, { x: 26, y: 25 }, { x: 24, y: 25 }, { x: 26, y: 27 }, { x: 27, y: 27 }, { x: 27, y: 26 }, { x: 27, y: 24 }, { x: 27, y: 23 }, { x: 26, y: 23 }, { x: 24, y: 23 }, { x: 23, y: 23 }, { x: 23, y: 24 }, { x: 23, y: 26 }, { x: 23, y: 27 }, { x: 24, y: 27 }] };

const CORE: Module = { cellsCache: { [prefix.defenseCell]: { poss: { x: 25, y: 25 } }, [prefix.powerCell]: { poss: { x: 24, y: 24 } } }, setup: { road: { pos: [{ x: 24, y: 24 }, { x: 25, y: 25 }, { x: 26, y: 26 }] }, storage: { pos: [{ x: 24, y: 25 }] }, factory: { pos: [{ x: 25, y: 26 }] }, terminal: { pos: [{ x: 26, y: 25 }] }, link: { pos: [{ x: 26, y: 24 }] }, nuker: { pos: [{ x: 24, y: 26 }] }, powerSpawn: { pos: [{ x: 25, y: 24 }] } }, freeSpaces: [] };

// box of 12 x 11 spawns at dist 1 from center except the opposite of biggest side

const CONSTRUCTIONS_PER_TYPE = 5;

// oh no i need to def
const ADD_RAMPART: (BuildableStructureConstant | undefined | null)[] = []//STRUCTURE_TOWER, STRUCTURE_SPAWN, STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_LAB, STRUCTURE_FACTORY, STRUCTURE_NUKER, STRUCTURE_POWER_SPAWN]; // STRUCTURE_LINK

type Job = { func: () => OK | ERR_BUSY | ERR_FULL, context: string };
interface CoustomFindPathOpts extends TravelToOptions { ignoreTypes?: BuildableStructureConstant[] };
function getPathArgs(opt: CoustomFindPathOpts = {}): TravelToOptions {
  return _.defaults(opt, {
    ignoreStructures: true, offRoad: true, maxRooms: 4, range: 0, weightOffRoad: 2,
    roomCallback: function(roomName: string, costMatrix: CostMatrix) {
      if (!Apiary.planner.activePlanning[roomName])
        return false;
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
            _.forEach(structure.pos.getOpenPositions(true, 1), p => costMatrix.set(p.x, p.y,
              Math.max(costMatrix.get(p.x, p.y), 0x03 * (2 - p.getTimeForPath(structure)))));
            costMatrix.set(structure.pos.x, structure.pos.y, 0xff);
          }
      }
      return costMatrix;
    }
  });
}

function anchorDist(anchor: RoomPosition, p: Pos, roomName: string = anchor.roomName, pathfind = false) {
  if (pathfind)
    return anchor.getTimeForPath(new RoomPosition(p.x, p.y, roomName));
  return anchor.getRangeApprox(new RoomPosition(p.x, p.y, roomName));
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
      cellsCache: { [id: string]: CellCache },
      protected: { [id: number]: { [id: number]: 0 | 1 } },
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
        if (ans === ERR_BUSY) {
          console.log("BUSY: ", jobs[0].context);
          break;
        }
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
    this.activePlanning[roomName] = { plan: [], placed: {}, freeSpaces: [], exits: [], jobsToDo: [], correct: "ok", cellsCache: {}, anchor: anchor, protected: {} };
    for (let t in CONSTRUCTION_COST)
      this.activePlanning[roomName].placed[<BuildableStructureConstant>t] = 0;
  }

  rotate(anchor: RoomPosition, pos: Pos, direction: 0 | 1 | 2 | 3, shiftY: number = 0, shiftX: number = 0) {
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

  generatePlan(anchor: RoomPosition, rotation: ExitConstant) {
    this.initPlanning(anchor.roomName, anchor);
    let jobs = this.activePlanning[anchor.roomName].jobsToDo;
    this.activePlanning[anchor.roomName].exits.push(anchor);

    let rotationBase: { [id in ExitConstant]: 0 | 1 | 2 | 3 } = {
      [TOP]: 2,
      [BOTTOM]: 3,
      [RIGHT]: 1,
      [LEFT]: 0,
    }

    let order: ExitConstant[] = [1, 5, 3, 7];
    order.splice(order.indexOf(rotation), 1);

    this.addModule(anchor.roomName, CORE, a => this.rotate(anchor, a, rotationBase[rotation]));

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

    let fillTypes = [STRUCTURE_TOWER, STRUCTURE_EXTENSION, STRUCTURE_OBSERVER];
    let net: RoomPosition[] = [];

    jobs.push({
      context: `creating net`,
      func: () => {
        for (let x = 5; x <= 45; ++x)
          for (let y = 5; y <= 45; ++y)
            if (anchor.x % 2 === x % 2 && anchor.y % 2 === y % 2) {
              let pos = new RoomPosition(x, y, anchor.roomName);
              if (pos.getRangeTo(anchor) > 2)
                net.push(pos);
            }
        let terrain = Game.map.getRoomTerrain(anchor.roomName);
        let plan = this.activePlanning[anchor.roomName].plan;

        net = net.filter(pos => {
          let positions = pos.getPositionsInRange(1);
          for (let i = 0; i < positions.length; ++i) {
            let p = positions[i];
            if (pos.getRangeApprox(p, "linear") > 1)
              continue;
            if (terrain.get(p.x, p.y) === TERRAIN_MASK_WALL || (plan[p.x] && plan[p.x][p.y] && plan[p.x][p.y].s))
              return false;
          }
          return true;
        });
        return OK;
      }
    });

    jobs.push({
      context: "adding fast refill cell",
      func: () => {
        // some cells for starters
        let terrain = Game.map.getRoomTerrain(anchor.roomName);
        let refillNet = net.filter(pos => {
          if (anchor.getRangeApprox(pos, "linear") <= 20)
            return false;
          return !pos.getPositionsInRange(3).filter(p => terrain.get(p.x, p.y) === TERRAIN_MASK_WALL && p.getRangeApprox(pos, "linear") <= 10).length;
        });

        let closest = anchor.findClosest(refillNet);
        if (!closest)
          return ERR_FULL;
        let pos = this.filterNet(anchor, closest, refillNet, 0);
        let rotation: 0 | 1 | 2 | 3;
        switch (pos.getDirectionTo(anchor)) {
          case TOP_LEFT:
          case TOP_RIGHT:
          case BOTTOM:
            rotation = 1;
            break;
          case RIGHT:
            rotation = 3;
            break;
          case LEFT:
            rotation = 2;
            break;
          default:
            rotation = 0;
        }
        let transformPos = (a: Pos) => this.rotate(pos, a, rotation);
        this.addModule(anchor.roomName, FAST_REFILL, transformPos);
        let spawns = FAST_REFILL.setup.spawn!.pos;
        for (let i = 0; i < spawns.length; ++i) {
          let pp = transformPos(spawns[i]);
          let spawnPos = new RoomPosition(pp.x, pp.y, anchor.roomName);
          let ans = this.connectWithRoad(anchor, spawnPos, true, { range: 1 });
          if (typeof ans === "number")
            return ERR_FULL;
        }
        for (let i = 0; i < net.length; ++i)
          if (net[i].getRangeTo(pos) <= 2) {
            net.splice(i, 1);
            --i;
          }
        return OK;
      }
    });

    jobs.push({
      context: "adding lab cell",
      func: () => {
        // some cells for starters
        let terrain = Game.map.getRoomTerrain(anchor.roomName);
        let plan = this.activePlanning[anchor.roomName].plan;
        let getTransformation = (pos: RoomPosition) => {
          let rotation: 0 | 1 | 2 | 3 = 0;
          switch (pos.getDirectionTo(anchor)) {
            case TOP_LEFT:
            case TOP_RIGHT:
            case BOTTOM:
              rotation = 1;
              break;
            case RIGHT:
              rotation = 3;
              break;
            case LEFT:
              rotation = 2;
              break;
            default:
              rotation = 0;
          }
          return (a: Pos) => this.rotate(pos, a, rotation);
        };
        let labNet = net.filter(pos => {
          if (anchor.getRangeApprox(pos, "linear") <= 15)
            return false;
          let transformTemp = getTransformation(pos);
          return !LABS.setup.lab!.pos.filter(pp => {
            let p = transformTemp(pp);
            return terrain.get(p.x, p.y) === TERRAIN_MASK_WALL || (plan[p.x] && plan[p.x][p.y] && plan[p.x][p.y].s !== STRUCTURE_ROAD)
          }).length;
        });
        let closest = anchor.findClosest(labNet);
        if (!closest)
          return ERR_FULL;
        let pos = this.filterNet(anchor, closest, labNet, 0);
        let transformPos = getTransformation(pos);
        this.addModule(anchor.roomName, LABS, transformPos);
        let ans = this.connectWithRoad(anchor, pos, true, { range: 1 });
        if (typeof ans === "number")
          return ERR_FULL;
        let extraNode = transformPos(LABS.setup.road!.pos[0]);
        for (let i = 0; i < net.length; ++i)
          if (net[i].getRangeApprox(pos) <= 2 || (net[i].x === extraNode.x && net[i].y === extraNode.y)) {
            net.splice(i, 1);
            --i;
          }
        return OK;
      }
    });

    for (let i in fillTypes) {
      let sType = fillTypes[i];
      jobs.push({
        context: `placing ${sType}`,
        func: () => {
          let free = this.activePlanning[anchor.roomName].freeSpaces;
          if (this.activePlanning[anchor.roomName].placed[sType]!! < CONTROLLER_STRUCTURES[sType][8]) {
            let anchorrr = anchor;
            let red = ((a: Pos, b: Pos) => {
              let ans = 0;
              let pathA = Traveler.findTravelPath(new RoomPosition(a.x, a.y, anchorrr.roomName), anchorrr, getPathArgs()).path;
              if (!pathA.length || !pathA[pathA.length - 1].equal(anchorrr))
                ans = 1;
              let pathB = Traveler.findTravelPath(new RoomPosition(b.x, b.y, anchorrr.roomName), anchorrr, getPathArgs()).path;
              if (!pathB.length || !pathB[pathB.length - 1].equal(anchorrr))
                ans = -1;
              if (ans === 0)
                ans = pathA.length - pathB.length;
              // ans *= sType === STRUCTURE_OBSERVER ? -1 : 1;
              if (ans === 0)
                ans = (a.y - b.y) * (rotation === TOP ? -1 : 1);
              if (ans === 0)
                ans = (a.x - b.x) * (rotation === LEFT ? -1 : 1);
              return ans < 0 ? a : b;
            });
            let pos;
            if (!free.length) {
              this.addFreeCell(anchor, net);
              free = this.activePlanning[anchor.roomName].freeSpaces;
            }
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
                if (!free.length) {
                  this.addFreeCell(anchor, net);
                  free = this.activePlanning[anchor.roomName].freeSpaces;
                  if (Game.cpu.getUsed() > Game.cpu.limit)
                    return ERR_BUSY;
                }
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

    this.addWalls(anchor.roomName);

    this.addResourceRoads(anchor);
    this.addUpgradeSite(anchor);
  }

  addWalls(roomName: string, padding = 3) {
    this.activePlanning[roomName].jobsToDo.push({
      context: `addingWalls`,
      func: () => {
        // this is A bad code but i don't use if often, so i won't rewrite
        let plan = this.activePlanning[roomName].plan;
        let prot = this.activePlanning[roomName].protected;
        for (let x = 2; x <= 47; ++x) {
          prot[x] = {};
          for (let y = 2; y <= 47; ++y)
            prot[x][y] = 0;
        }
        for (const x in plan)
          for (const y in plan[x])
            for (let dx = -padding; dx <= padding; ++dx)
              for (let dy = -padding; dy <= padding; ++dy)
                if (prot[+x + dx] && prot[+x + dx][+y + dy] !== undefined)
                  prot[+x + dx][+y + dy] = 1;
        let max = -1;
        let max2 = -1;
        let min = Infinity;
        let min2 = Infinity;
        let prevMax = 0;
        let prevMin = 0;
        let toFix: [number, number][] = [];
        let reset = () => {
          prevMax = max;
          prevMin = min;
          max = -1;
          max2 = -1;
          min = Infinity;
          min2 = Infinity;
        }
        let compare = (param: number) => {
          if (param > max) {
            max2 = max;
            max = param;
          }
          if (param < min)
            min = param;
          else if (param < min2)
            min2 = param;
        }
        let addToFix = (c: number, p: Pos) => {
          let b = - p.x * c + p.y;
          let ff = toFix.filter(v => v[0] === c);
          if (!ff.filter(v => v[1] === b).length)
            toFix.push([c, b]);
          if (!ff.filter(v => v[1] === b - 1).length)
            toFix.push([c, b - 1]);
          if (!ff.filter(v => v[1] === b + 1).length)
            toFix.push([c, b + 1]);
        }
        let addDef = (p: Pos, addRamp: boolean, force: number) => {
          if (addRamp || !(plan[p.x] && plan[p.x][p.y] && (plan[p.x][p.y].s === STRUCTURE_WALL || plan[p.x][p.y].r)))
            this.addToPlan(p, roomName, addRamp || !force ? STRUCTURE_RAMPART : STRUCTURE_WALL);
        }
        let use = (f: (a: number) => Pos, b: number, coef: -1 | 0 | 1) => {
          addDef(f(max), b === 0, coef);
          addDef(f(max2), b === 1, coef);
          addDef(f(min), b === 0, coef);
          addDef(f(min2), b === 1, coef);
          if (max !== prevMax && coef)
            addToFix(coef * (prevMax > max ? -1 : 1), f(prevMax));
          if (max !== prevMin && coef)
            addToFix(coef * (prevMin > min ? -1 : 1), f(prevMax));
        }
        for (let x = 2; x <= 47; ++x) {
          reset();
          for (let y = 2; y <= 47; ++y)
            if (prot[x][y] === 1)
              compare(y);
          use((a) => { return { x: x, y: a } }, x % 2, 1);
        }
        for (let y = 2; y <= 47; ++y) {
          reset();
          for (let x = 2; x <= 47; ++x)
            if (prot[x][y] === 1)
              compare(x);
          use((a) => { return { x: a, y: y } }, y % 2, -1);
        }
        for (let i = 0; i < toFix.length; ++i) {
          let f = (x: number) => toFix[i][0] * x + toFix[i][1];
          reset();
          for (let x = 2; x <= 47; ++x) {
            let y = f(x);
            if (y >= 2 && y <= 47)
              if (prot[x][y] === 1)
                compare(x);
          }
          use((a) => { return { x: a, y: f(a) } }, 3, 0);
        }
        this.removeNonUsedWalls(roomName);
        return OK;
      },
    });
  }

  removeNonUsedWalls(roomName: string) {
    this.activePlanning[roomName].jobsToDo.push({
      context: "removing walls",
      func: () => {
        let matrix: { [id: number]: { [id: number]: number } } = {}
        let enterances = getEnterances(roomName);
        matrix = {};
        for (let x = 0; x <= 49; ++x) {
          matrix[x] = {};
          for (let y = 0; y <= 49; ++y)
            matrix[x][y] = 0xff;
        }
        _.forEach(enterances, ent => this.dfs(ent, matrix));

        let plan = this.activePlanning[roomName].plan;

        for (const x in plan)
          for (const y in plan[x]) {
            if (matrix[x][y] > 3)
              if (plan[x] && plan[x][y] && plan[x][y].s === STRUCTURE_WALL)
                this.addToPlan({ x: +x, y: +y }, roomName, undefined, true);
              else if (plan[x] && plan[x][y])
                this.activePlanning[roomName].plan[x][y].r = false;
          }

        return OK;
      }
    });
  }

  dfs(pos: RoomPosition, matrix: { [id: number]: { [id: number]: number } }, depth: number = 1) {
    let plan = this.activePlanning[pos.roomName].plan;
    if (depth < 4) {
      let s = plan[pos.x] && plan[pos.x][pos.y];
      if (s && (s.s === STRUCTURE_WALL || s.r))
        ++depth;
      else if (depth > 1)
        ++depth;
    }
    matrix[pos.x][pos.y] = depth;
    if (depth < 4) {
      let terrain = Game.map.getRoomTerrain(pos.roomName);
      _.forEach(pos.getPositionsInRange(1), p => {
        if (terrain.get(p.x, p.y) === TERRAIN_MASK_WALL)
          return;
        let curr = matrix[p.x][p.y];
        if (curr <= depth)
          return;
        this.dfs(p, matrix, depth);
      });
    }
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
      let ans = anchor.getRoomRangeTo(a, "path") - anchor.getRoomRangeTo(b, "path");
      if (ans === 0)
        return anchor.getTimeForPath(a) - anchor.getTimeForPath(b);
      return ans;
    });

    if (fromMem)
      _.forEach(futureResourceCells, f => {
        if (!this.activePlanning[f.pos.roomName])
          this.toActive(anchor, f.pos.roomName);
      });

    _.forEach(futureResourceCells, f => {
      if (!this.activePlanning[f.pos.roomName])
        this.initPlanning(f.pos.roomName, anchor);
      if (fromMem) {
        let plan = this.activePlanning[f.pos.roomName].plan;
        _.forEach(f.pos.getPositionsInRange(1), p => {
          if (plan[p.x] && plan[p.x][p.y] && plan[p.x][p.y].s === STRUCTURE_CONTAINER)
            plan[p.x][p.y].s = undefined;
        });
      }
    });

    _.forEach(futureResourceCells, f => {
      this.activePlanning[anchor.roomName].jobsToDo.push({
        context: `resource road for ${f.pos}`,
        func: () => {
          this.activePlanning[anchor.roomName].exits = [anchor].concat(this.activePlanning[anchor.roomName].exits.filter(e => e.roomName !== anchor.roomName));
          let ans = this.connectWithRoad(anchor, f.pos, true, { range: 1 });
          if (typeof ans === "number")
            return ans;
          let room = Game.rooms[f.pos.roomName];
          if (f.secondaryColor === COLOR_YELLOW) {
            let existingContainer = room && f.pos.findInRange(FIND_STRUCTURES, 1).filter(s => s.structureType === STRUCTURE_CONTAINER)[0];
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
            let existingContainer = room && f.pos.findInRange(FIND_STRUCTURES, 1).filter(s => s.structureType === STRUCTURE_CONTAINER)[0];
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

    _.forEach(path.filter(p => !p.enteranceToRoom), p => this.addToPlan(p, p.roomName, addRoads ? STRUCTURE_ROAD : null));

    // console. log(`${anchor} ->   ${exit}-${path.length}->${new RoomPosition(lastPath.x, lastPath.y, exit.roomName)}   -> ${pos}`);
    exit = path[path.length - 1];
    if (exit.getRangeTo(pos) > opt.range!) {
      let ent = exit.enteranceToRoom;
      this.activePlanning[roomName].exits.push(ent ? ent : exit);
      return ERR_BUSY;
    }
    return path[path.length - 1];
  }

  addToPlan(pos: Pos, roomName: string, sType: BuildableStructureConstant | null | undefined, force: boolean = false, check: boolean = false) {
    if (pos.x <= 0 || pos.y <= 0 || pos.x >= 49 || pos.y >= 49)
      return ERR_NO_PATH;
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
    let info = { s: plan[pos.x][pos.y].s, r: plan[pos.x][pos.y].r };
    if (sType === STRUCTURE_RAMPART) {
      if (info.s === STRUCTURE_WALL)
        info.s = undefined;
      info.r = true;
    } else if (sType === undefined && force) {
      if (info.s && !check)
        placed[info.s]!--;
      info = { s: undefined, r: false };
    } else if (info.s === undefined && !(info.r && sType === STRUCTURE_WALL)) {
      if (sType) {
        if (placed[sType]! >= CONTROLLER_STRUCTURES[sType][8])
          return ERR_FULL;
        if (!check)
          placed[sType]!++;
      }
      info.s = sType;
    } else if (info.s === STRUCTURE_WALL && sType !== STRUCTURE_WALL) {
      info = { s: sType, r: true };
    } else if (sType === STRUCTURE_WALL && info.s !== STRUCTURE_WALL) {
      info.r = true;
    } else if (force) {
      if (info.s && !check)
        placed[info.s]!--;
      if (sType && !check)
        placed[sType]!++;
      info.s = sType;
    } else
      return ERR_NO_PATH;
    if (!check)
      plan[pos.x][pos.y] = info;
    return OK;
  }

  filterNet(anchor: RoomPosition, closest: RoomPosition, net: RoomPosition[], padding = 5) {
    let potentialCells = net.filter(n => n.getRangeTo(anchor) <= anchor.getRangeTo(closest) + padding);
    let pos = potentialCells[0];
    let dist = Traveler.findTravelPath(anchor, pos, getPathArgs({ weightOffRoad: 1 })).path.length;
    for (let i = 1; i < potentialCells.length; ++i) {
      let newPos = potentialCells[i];
      let newDist = Traveler.findTravelPath(anchor, newPos, getPathArgs({ weightOffRoad: 1 })).path.length;
      if (dist > newDist) {
        dist = newDist;
        pos = newPos;
      }
    }
    return pos;
  }

  addFreeCell(anchor: RoomPosition, net: RoomPosition[]) {
    let closest = anchor.findClosest(net);
    if (!closest)
      return;
    let pos = this.filterNet(anchor, closest, net);
    this.addModule(anchor.roomName, FREE_CELL, a => this.rotate(pos, a, 0));
    for (let i = 0; i < net.length; ++i)
      if (net[i].getRangeApprox(pos) <= 2) {
        net.splice(i, 1);
        --i;
      }
    this.connectWithRoad(anchor, pos, true, { range: 1 });
    return;
  }

  addModule(roomName: string, configuration: Module, transformPos: (a: Pos) => Pos) {
    this.activePlanning[roomName].freeSpaces = this.activePlanning[roomName].freeSpaces
      .concat(configuration.freeSpaces.map(p => transformPos(p)).filter(p => Game.map.getRoomTerrain(roomName).get(p.x, p.y) !== TERRAIN_MASK_WALL));

    for (let cellType in configuration.cellsCache) {
      let cache = configuration.cellsCache[cellType];
      let transformedCache: CellCache = { poss: transformPos(cache.poss) };
      this.activePlanning[roomName].cellsCache[cellType] = transformedCache;
    }

    for (let t in configuration.setup) {
      let sType = <keyof Module["setup"]>t;
      let poss = configuration.setup[sType]!.pos;
      for (let i = 0; i < poss.length; ++i) {
        let ans = transformPos(poss[i]);
        if (this.addToPlan(ans, roomName, sType === "null" ? null : sType, sType !== STRUCTURE_ROAD) === ERR_FULL && sType !== STRUCTURE_LAB)
          this.activePlanning[roomName].freeSpaces.push(ans);
      }
    }
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
      for (const cellType in Memory.cache.hives[roomName].cells) {
        let cellCache = Memory.cache.hives[roomName].cells[cellType];
        if ("poss" in cellCache)
          this.activePlanning[roomName].cellsCache[cellType] = { poss: cellCache.poss };
      }
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
        if (s.pos.enteranceToRoom)
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
        let ans = a.dist - b.dist;
        if (sType === STRUCTURE_LINK && contr)
          if (contr.pos.getRangeTo(new RoomPosition(a.pos.x, a.pos.y, roomName)) <= 3)
            ans = -1;
          else if (contr.pos.getRangeTo(new RoomPosition(b.pos.x, b.pos.y, roomName)) <= 3)
            ans = 1;
        if (ans === 0)
          ans = terrain.get(a.pos.x, a.pos.y) - terrain.get(b.pos.x, b.pos.y)
        return ans; //* (sType === STRUCTURE_RAMPART || sType === STRUCTURE_WALL ? -1 : 1);
      });
      Memory.cache.roomPlanner[roomName][sType]!.pos = posWeighted.map(p => p.pos);
    }

    let cellsCache = this.activePlanning[roomName].cellsCache;
    if (Object.keys(cellsCache).length) {
      if (!Memory.cache.hives[roomName])
        Memory.cache.hives[roomName] = { wallsHealth: Memory.settings.wallsHealth * 0.0005, cells: {}, do: { ...BASE_MODE_HIVE } };
      for (let cellType in cellsCache) {
        let cellCache = cellsCache[cellType];
        if (!Memory.cache.hives[roomName].cells[cellType.split("_")[0]])
          Memory.cache.hives[roomName].cells[cellType.split("_")[0]] = {};
        for (let key in cellCache)
          Memory.cache.hives[roomName].cells[cellType.split("_")[0]][key] = cellCache[<keyof CellCache>key];
      }
    }
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
        hitsMax = Memory.settings.wallsHealth * 0.0005;
        if (controller.level < 4)
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

  checkBuildings(roomName: string, priorityQue: BuildableStructureConstant[], nukeAlert: boolean, specials: { [key in StructureConstant]?: number } = {}, coef = 0.7): [BuildProject[], number] {
    if (!(roomName in Game.rooms) || !Memory.cache.roomPlanner[roomName])
      return [[], 0];

    let contr = Game.rooms[roomName].controller
    let hive = Apiary.hives[roomName];
    let controller: StructureController | { level: number } | undefined = contr;
    if (!controller)
      controller = { level: 0 };

    let ans: BuildProject[] = [];
    let constructions = 0;
    let defenseIndex = Math.min(priorityQue.indexOf(STRUCTURE_RAMPART), priorityQue.indexOf(STRUCTURE_WALL));
    let firstDefense = defenseIndex > 0 ? priorityQue[defenseIndex] : "";
    let energyCost = 0;
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
            ans.push({
              pos: pos,
              sType: sType,
              targetHits: 0,
              energyCost: constructionSite.progressTotal - constructionSite.progress,
              type: "construction",
            });
            ++constructions;
            if (sType === STRUCTURE_RAMPART || sType === STRUCTURE_WALL) {
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
            }
          } else if (constructionSite.my && constructionSite.structureType !== STRUCTURE_RAMPART && sType !== STRUCTURE_RAMPART)
            constructionSite.remove();
        } else if (structure) {
          placed++;
          let heal = this.getCase(structure).heal;
          if (sType in specials)
            heal = specials[sType]!;
          if (nukeAlert && (sType === STRUCTURE_RAMPART || sType === STRUCTURE_WALL)) {
            let nukeDmg = _.sum(pos.findInRange(FIND_NUKES, 2), n => !n.pos.getRangeTo(pos) ? NUKE_DAMAGE[0] : NUKE_DAMAGE[2]);
            if (nukeDmg > 0 && nukeDmg <= heal * 2)
              heal = nukeDmg / coef + heal / 2;
            else if (nukeDmg > heal)
              heal = 0;
          }
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
      energyCost += _.sum(ans, cc => cc.energyCost);
      if (!constructions)
        for (let i = 0; i < toadd.length && i < cc.amount - placed; ++i) {
          let anss;
          if (constructions < CONSTRUCTIONS_PER_TYPE && (!nukeAlert || !toadd[i].findInRange(FIND_NUKES, 2).length))
            if (sType === STRUCTURE_SPAWN)
              anss = toadd[i].createConstructionSite(sType, roomName.toLowerCase() + makeId(4));
            else
              anss = toadd[i].createConstructionSite(sType);
          if (anss === OK) {
            ans.push({
              pos: toadd[i],
              sType: sType,
              targetHits: 0,
              energyCost: CONSTRUCTION_COST[sType],
              type: "construction",
            });
            ++constructions;
          }
          energyCost += CONSTRUCTION_COST[sType];
          if (sType === STRUCTURE_RAMPART || sType === STRUCTURE_WALL) {
            let heal = this.getCase({ structureType: sType, pos: toadd[i], hitsMax: WALL_HITS_MAX }).heal;
            if (sType in specials)
              heal = specials[sType]!;
            if (anss === OK)
              ans.push({
                pos: toadd[i],
                sType: sType,
                targetHits: heal,
                energyCost: Math.ceil(heal / 100),
                type: "repair",
              });
            energyCost += Math.ceil(heal / 100);
          }
        }
    }
    return [ans, energyCost];
  }
}
