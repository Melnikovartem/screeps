import { makeId } from "./utils";
import { profile } from "./profiler/decorator";

export type RoomSetup = { [key in BuildableStructureConstant]?: { "pos": { "x": number, "y": number }[] } };

type Module = { setup: RoomSetup, freeSpaces: Pos[], exits: Pos[] }

const BASE_HORIZONTAL: Module = { exits: [{ "x": 20, "y": 24 }, { "x": 20, "y": 26 }], freeSpaces: [{ "x": 25, "y": 24 }, { "x": 26, "y": 24 }, { "x": 26, "y": 25 }], setup: { "road": { "pos": [{ "x": 25, "y": 25 }, { "x": 26, "y": 26 }, { "x": 24, "y": 24 }, { "x": 23, "y": 24 }, { "x": 24, "y": 23 }, { "x": 26, "y": 27 }, { "x": 27, "y": 26 }, { "x": 28, "y": 25 }, { "x": 25, "y": 22 }, { "x": 27, "y": 24 }, { "x": 26, "y": 23 }, { "x": 25, "y": 28 }, { "x": 22, "y": 25 }, { "x": 23, "y": 26 }, { "x": 24, "y": 27 }, { "x": 21, "y": 25 }, { "x": 20, "y": 24 }, { "x": 20, "y": 26 }] }, "lab": { "pos": [{ "x": 21, "y": 24 }, { "x": 22, "y": 24 }, { "x": 23, "y": 25 }, { "x": 22, "y": 26 }, { "x": 21, "y": 26 }, { "x": 20, "y": 25 }, { "x": 20, "y": 23 }, { "x": 21, "y": 23 }, { "x": 20, "y": 27 }, { "x": 21, "y": 27 }] }, "storage": { "pos": [{ "x": 25, "y": 26 }] }, "link": { "pos": [{ "x": 24, "y": 25 }] }, "terminal": { "pos": [{ "x": 24, "y": 26 }] } } };

const BASE_VERTICAL: Module = { exits: [{ "x": 20, "y": 26 }, { "x": 20, "y": 24 }], freeSpaces: [{ "x": 23, "y": 28 }, { "x": 23, "y": 22 }, { "x": 22, "y": 27 }, { "x": 22, "y": 23 }, { "x": 25, "y": 24 }, { "x": 26, "y": 24 }, { "x": 26, "y": 25 }], setup: { "road": { "pos": [{ "x": 25, "y": 25 }, { "x": 26, "y": 26 }, { "x": 24, "y": 24 }, { "x": 23, "y": 24 }, { "x": 24, "y": 23 }, { "x": 26, "y": 27 }, { "x": 27, "y": 26 }, { "x": 28, "y": 25 }, { "x": 25, "y": 22 }, { "x": 27, "y": 24 }, { "x": 26, "y": 23 }, { "x": 25, "y": 28 }, { "x": 22, "y": 25 }, { "x": 23, "y": 26 }, { "x": 24, "y": 27 }, { "x": 21, "y": 25 }, { "x": 20, "y": 24 }, { "x": 20, "y": 26 }, { "x": 23, "y": 23 }, { "x": 22, "y": 22 }, { "x": 21, "y": 21 }, { "x": 23, "y": 27 }, { "x": 22, "y": 28 }, { "x": 21, "y": 29 }] }, "lab": { "pos": [{ "x": 21, "y": 24 }, { "x": 22, "y": 24 }, { "x": 23, "y": 25 }, { "x": 22, "y": 26 }, { "x": 21, "y": 26 }, { "x": 20, "y": 25 }, { "x": 20, "y": 23 }, { "x": 21, "y": 23 }, { "x": 20, "y": 27 }, { "x": 21, "y": 27 }] }, "storage": { "pos": [{ "x": 25, "y": 26 }] }, "link": { "pos": [{ "x": 24, "y": 25 }] }, "terminal": { "pos": [{ "x": 24, "y": 26 }] }, "extension": { "pos": [{ "x": 20, "y": 28 }, { "x": 21, "y": 28 }, { "x": 20, "y": 30 }, { "x": 21, "y": 30 }, { "x": 22, "y": 29 }, { "x": 21, "y": 22 }, { "x": 20, "y": 22 }, { "x": 20, "y": 20 }, { "x": 21, "y": 20 }, { "x": 22, "y": 21 }, { "x": 20, "y": 21 }, { "x": 20, "y": 29 }] } } };

const EXTRA_VERTICAL: Module = { exits: [{ "x": 23, "y": 22 }, { "x": 25, "y": 22 }, { "x": 27, "y": 22 }], freeSpaces: [{ "x": 23, "y": 26 }, { "x": 24, "y": 25 }, { "x": 26, "y": 25 }, { "x": 27, "y": 26 }], setup: { "road": { "pos": [{ "x": 25, "y": 24 }, { "x": 23, "y": 25 }, { "x": 22, "y": 24 }, { "x": 21, "y": 23 }, { "x": 27, "y": 25 }, { "x": 26, "y": 23 }, { "x": 24, "y": 23 }, { "x": 25, "y": 22 }, { "x": 27, "y": 22 }, { "x": 23, "y": 22 }, { "x": 28, "y": 24 }, { "x": 29, "y": 23 }] }, "lab": { "pos": [] }, "storage": { "pos": [] }, "link": { "pos": [] }, "terminal": { "pos": [] }, "spawn": { "pos": [{ "x": 25, "y": 26 }] }, "extension": { "pos": [{ "x": 24, "y": 24 }, { "x": 26, "y": 24 }, { "x": 27, "y": 24 }, { "x": 27, "y": 23 }, { "x": 28, "y": 23 }, { "x": 28, "y": 26 }, { "x": 28, "y": 25 }, { "x": 29, "y": 25 }, { "x": 29, "y": 24 }, { "x": 30, "y": 24 }, { "x": 30, "y": 23 }, { "x": 30, "y": 22 }, { "x": 29, "y": 22 }, { "x": 28, "y": 22 }, { "x": 23, "y": 24 }, { "x": 23, "y": 23 }, { "x": 22, "y": 23 }, { "x": 22, "y": 22 }, { "x": 21, "y": 22 }, { "x": 20, "y": 22 }, { "x": 20, "y": 23 }, { "x": 21, "y": 24 }, { "x": 21, "y": 25 }, { "x": 22, "y": 25 }, { "x": 22, "y": 26 }, { "x": 20, "y": 24 }] }, "tower": { "pos": [{ "x": 25, "y": 23 }, { "x": 24, "y": 22 }, { "x": 26, "y": 22 }] } } };

const EXTRA_HORIZONTAL: Module = { exits: [{ "x": 20, "y": 23 }, { "x": 20, "y": 27 }], freeSpaces: [{ "x": 21, "y": 25 }, { "x": 22, "y": 24 }, { "x": 22, "y": 26 }], setup: { "road": { "pos": [{ "x": 20, "y": 23 }, { "x": 22, "y": 25 }, { "x": 21, "y": 26 }, { "x": 20, "y": 27 }, { "x": 21, "y": 24 }] }, "lab": { "pos": [] }, "storage": { "pos": [] }, "link": { "pos": [] }, "terminal": { "pos": [] }, "spawn": { "pos": [{ "x": 23, "y": 25 }] }, "extension": { "pos": [{ "x": 21, "y": 27 }, { "x": 20, "y": 28 }, { "x": 20, "y": 22 }, { "x": 21, "y": 23 }] }, "tower": { "pos": [{ "x": 20, "y": 24 }, { "x": 20, "y": 26 }, { "x": 20, "y": 25 }] } } };

const WALLS: Module = { exits: [], freeSpaces: [], setup: { "road": { "pos": [] }, "lab": { "pos": [] }, "storage": { "pos": [] }, "link": { "pos": [] }, "terminal": { "pos": [] }, "extension": { "pos": [] }, "constructedWall": { "pos": [{ "x": 17, "y": 20 }, { "x": 19, "y": 20 }, { "x": 19, "y": 22 }, { "x": 19, "y": 23 }, { "x": 19, "y": 24 }, { "x": 19, "y": 25 }, { "x": 19, "y": 26 }, { "x": 19, "y": 21 }, { "x": 17, "y": 22 }, { "x": 17, "y": 23 }, { "x": 17, "y": 24 }, { "x": 17, "y": 25 }, { "x": 17, "y": 21 }, { "x": 17, "y": 27 }, { "x": 17, "y": 28 }, { "x": 17, "y": 29 }, { "x": 17, "y": 30 }, { "x": 17, "y": 31 }, { "x": 17, "y": 26 }, { "x": 19, "y": 28 }, { "x": 19, "y": 29 }, { "x": 19, "y": 30 }, { "x": 19, "y": 27 }, { "x": 20, "y": 31 }, { "x": 21, "y": 31 }, { "x": 22, "y": 31 }, { "x": 23, "y": 31 }, { "x": 24, "y": 31 }, { "x": 19, "y": 31 }, { "x": 26, "y": 31 }, { "x": 27, "y": 31 }, { "x": 28, "y": 31 }, { "x": 29, "y": 31 }, { "x": 25, "y": 31 }, { "x": 30, "y": 31 }, { "x": 20, "y": 19 }, { "x": 21, "y": 19 }, { "x": 22, "y": 19 }, { "x": 23, "y": 19 }, { "x": 24, "y": 19 }, { "x": 25, "y": 19 }, { "x": 26, "y": 19 }, { "x": 27, "y": 19 }, { "x": 19, "y": 19 }, { "x": 28, "y": 19 }, { "x": 29, "y": 19 }, { "x": 31, "y": 19 }, { "x": 30, "y": 19 }, { "x": 17, "y": 32 }, { "x": 17, "y": 33 }, { "x": 19, "y": 33 }, { "x": 20, "y": 33 }, { "x": 21, "y": 33 }, { "x": 22, "y": 33 }, { "x": 23, "y": 33 }, { "x": 24, "y": 33 }, { "x": 25, "y": 33 }, { "x": 26, "y": 33 }, { "x": 27, "y": 33 }, { "x": 28, "y": 33 }, { "x": 29, "y": 33 }, { "x": 30, "y": 33 }, { "x": 31, "y": 33 }, { "x": 32, "y": 33 }, { "x": 33, "y": 33 }, { "x": 18, "y": 33 }, { "x": 17, "y": 18 }, { "x": 17, "y": 17 }, { "x": 18, "y": 17 }, { "x": 19, "y": 17 }, { "x": 20, "y": 17 }, { "x": 21, "y": 17 }, { "x": 22, "y": 17 }, { "x": 23, "y": 17 }, { "x": 24, "y": 17 }, { "x": 25, "y": 17 }, { "x": 26, "y": 17 }, { "x": 27, "y": 17 }, { "x": 28, "y": 17 }, { "x": 29, "y": 17 }, { "x": 30, "y": 17 }, { "x": 31, "y": 17 }, { "x": 32, "y": 17 }, { "x": 33, "y": 17 }, { "x": 17, "y": 19 }, { "x": 32, "y": 19 }, { "x": 32, "y": 21 }, { "x": 32, "y": 22 }, { "x": 32, "y": 23 }, { "x": 32, "y": 24 }, { "x": 32, "y": 25 }, { "x": 32, "y": 26 }, { "x": 32, "y": 27 }, { "x": 32, "y": 28 }, { "x": 32, "y": 29 }, { "x": 32, "y": 30 }, { "x": 32, "y": 31 }, { "x": 31, "y": 31 }, { "x": 32, "y": 20 }, { "x": 34, "y": 33 }, { "x": 34, "y": 31 }, { "x": 34, "y": 30 }, { "x": 34, "y": 29 }, { "x": 34, "y": 28 }, { "x": 34, "y": 27 }, { "x": 34, "y": 26 }, { "x": 34, "y": 25 }, { "x": 34, "y": 24 }, { "x": 34, "y": 23 }, { "x": 34, "y": 22 }, { "x": 34, "y": 21 }, { "x": 34, "y": 20 }, { "x": 34, "y": 19 }, { "x": 34, "y": 18 }, { "x": 34, "y": 17 }, { "x": 34, "y": 32 }] } } };

const SPECIAL_STRUCTURE: { [key in StructureConstant]?: { [level: number]: { amount: number, heal: number } } } = {
  [STRUCTURE_ROAD]: { 0: { amount: 2500, heal: ROAD_HITS / 2 }, 1: { amount: 0, heal: ROAD_HITS / 2 }, 2: { amount: 0, heal: ROAD_HITS / 2 }, 3: { amount: 2500, heal: ROAD_HITS / 2 }, 4: { amount: 2500, heal: ROAD_HITS / 2 }, 5: { amount: 2500, heal: ROAD_HITS / 2 }, 6: { amount: 2500, heal: ROAD_HITS / 2 }, 7: { amount: 2500, heal: ROAD_HITS / 2 }, 8: { amount: 2500, heal: ROAD_HITS } },
  [STRUCTURE_WALL]: { 0: { amount: 0, heal: 0 }, 1: { amount: 0, heal: 10000 }, 2: { amount: 2500, heal: 10000 }, 3: { amount: 2500, heal: 10000 }, 4: { amount: 2500, heal: 100000 }, 5: { amount: 2500, heal: 100000 }, 6: { amount: 2500, heal: 500000 }, 7: { amount: 2500, heal: 500000 }, 8: { amount: 2500, heal: 1000000 } },
  [STRUCTURE_RAMPART]: { 0: { amount: 0, heal: 0 }, 1: { amount: 0, heal: 10000 }, 2: { amount: 2500, heal: 10000 }, 3: { amount: 2500, heal: 10000 }, 4: { amount: 2500, heal: 100000 }, 5: { amount: 2500, heal: 100000 }, 6: { amount: 2500, heal: 500000 }, 7: { amount: 2500, heal: 500000 }, 8: { amount: 2500, heal: 1000000 } }
}
export type Pos = { x: number, y: number };
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

@profile
export class RoomPlanner {
  activePlanning: {
    [id: string]: {
      plan: { [id: number]: { [id: number]: { s: BuildableStructureConstant | undefined | null, r: boolean } } },
      placed: { [key in StructureConstant]?: number },
      freeSpaces: Pos[], exits: RoomPosition[],
      jobsToDo: Job[]; // ERR_BUSY - repeat job, ERR_FULL - failed
      correct: "ok" | "fail" | "work";
    }
  } = {};

  run() {
    // CPU for planner - least important one
    for (let roomName in this.activePlanning) {
      if (this.activePlanning[roomName].correct === "work") {
        let jobs = this.activePlanning[roomName].jobsToDo;
        while (jobs.length) {
          let ans
          try {
            ans = jobs[0].func();
          } catch {
            ans = ERR_BUSY;
          }
          if (ans === ERR_FULL) {
            this.activePlanning[roomName].correct = "fail";
            console.log("failed", roomName, jobs[0].context);
          }
          if (ans !== OK)
            break;
          jobs.shift();
        }
        if (!jobs.length && this.activePlanning[roomName].correct !== "fail") {
          console.log("success", roomName);
          this.activePlanning[roomName].correct = "ok";
        }
      }
    }
  }

  initPlanning(roomName: string, correct: boolean = false) {
    this.activePlanning[roomName] = { plan: [], placed: {}, freeSpaces: [], exits: [], jobsToDo: [], correct: correct ? "ok" : "work" };
    for (let t in CONSTRUCTION_COST)
      this.activePlanning[roomName].placed[<BuildableStructureConstant>t] = 0;
  }

  generatePlan(anchor: RoomPosition, baseRotation: 0 | 1 | 2 | 3 = 0) {
    this.initPlanning(anchor.roomName);
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
    if (baseRotation !== 2)
      this.addModule(anchor, EXTRA_VERTICAL, (a) => rotate(a, 0, -3)); // top
    if (baseRotation !== 3)
      this.addModule(anchor, EXTRA_VERTICAL, (a) => rotate(a, 1, 3)); // bottom
    if (baseRotation !== 1)
      this.addModule(anchor, EXTRA_HORIZONTAL, (a) => rotate(a, 1, 0)); // right
    if (baseRotation !== 0)
      this.addModule(anchor, EXTRA_HORIZONTAL, (a) => rotate(a, 0)); // left
    this.addModule(anchor, baseRotation > 1 ? BASE_VERTICAL : BASE_HORIZONTAL, (a) => rotate(a, baseRotation));

    let futureResourceCells = _.filter(Game.flags, (f) => f.color === COLOR_YELLOW && f.memory.hive === anchor.roomName);
    futureResourceCells.sort((a, b) => a.pos.getRoomRangeTo(anchor, true) - b.pos.getRoomRangeTo(anchor, true))
    _.forEach(futureResourceCells, (f) => {
      if (f.color === COLOR_CYAN)
        this.addToPlan(f.pos, f.pos.roomName, STRUCTURE_EXTRACTOR);
      jobs.push({
        context: "resource roads",
        func: () => {
          let ans = this.connectWithRoad(anchor, f.pos);
          if (ans === ERR_FULL || ans === ERR_BUSY)
            return ans;
          this.addToPlan(ans, f.pos.roomName, STRUCTURE_CONTAINER, true);
          return OK;
        }
      });
    });

    jobs.push({
      context: "upgrade site",
      func: () => {
        let contr = Game.rooms[anchor.roomName] && Game.rooms[anchor.roomName].controller;
        if (contr) {
          let poss = contr.pos.getOpenPositions(true);
          _.forEach(poss, (p) => this.addToPlan(p, anchor.roomName, STRUCTURE_WALL));
          poss = contr.pos.getPositionsInRange(2);
          poss.sort((a, b) => a.getRangeTo(anchor) - b.getRangeTo(anchor));
          let pos: RoomPosition | undefined;
          _.some(poss, (p) => {
            if (this.addToPlan(p, anchor.roomName, STRUCTURE_LINK) === OK)
              pos = p;
            return pos;
          });
          if (pos)
            this.connectWithRoad(anchor, pos);
          else
            return ERR_FULL;
        }
        return OK;
      }
    });

    jobs.push({
      context: "exits to rooms",
      func: () => {
        let exitsGlobal = Game.map.describeExits(anchor.roomName);
        for (let e in exitsGlobal) {
          if (exitsGlobal[<ExitConstant>+e]) {
            let exit = anchor.findClosest(Game.rooms[anchor.roomName].find(<ExitConstant>+e));
            if (exit) {
              let ans = this.connectWithRoad(anchor, exit, false);
              if (ans === ERR_FULL || ans === ERR_BUSY)
                return ans;
            } else
              return ERR_BUSY;
          }
        }
        return OK;
      }
    });

    this.addModule(anchor, WALLS, (a) => rotate(a, baseRotation));

    let fillTypes = [STRUCTURE_EXTENSION, STRUCTURE_OBSERVER];
    jobs.push({
      context: "filling in",
      func: () => {
        let placed = this.activePlanning[anchor.roomName].placed;
        for (let i in fillTypes) {
          let sType = fillTypes[i];
          if (placed[sType]! < CONTROLLER_STRUCTURES[sType][8]) {
            let pos = this.activePlanning[anchor.roomName].freeSpaces.shift();
            while (pos)
              if (this.addToPlan(pos, anchor.roomName, sType) === ERR_FULL)
                break;
              else
                pos = this.activePlanning[anchor.roomName].freeSpaces.shift();
            if (placed[sType]! < CONTROLLER_STRUCTURES[sType][8])
              return ERR_FULL;
          }
        }
        return OK;
      }
    });
  }

  connectWithRoad(anchor: RoomPosition, pos: RoomPosition, addRoads: boolean = anchor.roomName === pos.roomName): Pos | ERR_BUSY | ERR_FULL {
    let exit = pos.findClosestByPath(this.activePlanning[anchor.roomName].exits, PATH_ARGS);
    if (!exit)
      exit = pos.findClosest(this.activePlanning[anchor.roomName].exits);
    if (!exit)
      return ERR_FULL;
    let path = exit.findPathTo(pos, PATH_ARGS);
    if (path.length === 0)
      return ERR_FULL;

    let lastPath = path.pop()!;
    if (addRoads)
      _.forEach(path, (pos) => this.addToPlan(pos, exit!.roomName, STRUCTURE_ROAD));
    else
      _.forEach(path, (pos) => this.addToPlan(pos, exit!.roomName, null));

    let exitPos = path.length > 0 ? path[path.length - 1] : lastPath;
    exit = new RoomPosition(exitPos.x, exitPos.y, exit.roomName);
    if (pos.x !== lastPath.x || pos.y !== lastPath.y || pos.roomName !== exit.roomName) {
      let ent = exit.getEnteranceToRoom();
      this.activePlanning[anchor.roomName].exits.push(ent ? ent : exit);
      return ERR_BUSY;
    }
    return exit;
  }

  addToPlan(pos: Pos, roomName: string, sType: BuildableStructureConstant | null, force: boolean = false) {
    if (!this.activePlanning[roomName])
      this.initPlanning(roomName);
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
          .concat(_.filter(_.map(configuration.freeSpaces, (p) => transformPos(p))));

        this.activePlanning[anchor.roomName].exits = this.activePlanning[anchor.roomName].exits
          .concat(_.map(configuration.exits, (p) => {
            let ans = transformPos(p);
            return new RoomPosition(ans.x, ans.y, anchor.roomName);
          }));

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

  saveActive(roomName: string) {
    let active = this.activePlanning[roomName];
    if (!(active))
      return;
    Memory.cache.roomPlanner[roomName] = {};
    for (let x in active.plan)
      for (let y in active.plan[+x]) {
        if (active.plan[+x][+y].s)
          this.addToCache({ x: +x, y: +y }, roomName, active.plan[+x][+y].s!);
        if (active.plan[+x][+y].r)
          this.addToCache({ x: +x, y: +y }, roomName, STRUCTURE_RAMPART);
      }
  }

  addToCache(pos: Pos, roomName: string, sType: BuildableStructureConstant) {
    if (!Memory.cache.roomPlanner[roomName][sType])
      Memory.cache.roomPlanner[roomName][sType] = { "pos": [] };
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

  checkBuildings(roomName: string) {
    if (!(roomName in Game.rooms) || !Memory.cache.roomPlanner[roomName])
      return { pos: [], sum: 0 };

    let controller: StructureController | { level: number } | undefined = Game.rooms[roomName].controller;
    if (!controller)
      controller = { level: 0 };

    let ans: RoomPosition[] = [];
    let sum = 0;
    let constructions = 0;
    for (let t in Memory.cache.roomPlanner[roomName]) {
      let sType = <BuildableStructureConstant>t;
      let cc = this.getCase({ structureType: sType, pos: { roomName: roomName }, hitsMax: 0 });
      let positions = Memory.cache.roomPlanner[roomName][sType]!.pos;
      for (let i = 0; i < cc.amount && i < positions.length; ++i) {
        let pos = new RoomPosition(positions[i].x, positions[i].y, roomName);
        let structure = <Structure<BuildableStructureConstant> | undefined>_.filter(pos.lookFor(LOOK_STRUCTURES),
          (s) => s.structureType === sType)[0];
        if (!structure) {
          let constructionSite = _.filter(pos.lookFor(LOOK_CONSTRUCTION_SITES), (s) => s.structureType === sType)[0];
          if (!constructionSite) {
            if (constructions < 10) {
              let place = _.filter(pos.lookFor(LOOK_STRUCTURES), (s) => s.structureType !== STRUCTURE_RAMPART)[0];
              if (place && sType !== STRUCTURE_RAMPART) {
                if ((<OwnedStructure>place).my) {
                  if (sType !== STRUCTURE_SPAWN)
                    place.destroy();
                } else
                  place.pos.createFlag(makeId(4), COLOR_GREY, COLOR_RED);
              } else {
                sum += CONSTRUCTION_COST[sType];
                pos.createConstructionSite(sType);
                ans.push(pos);
                constructions++;
              }
            }
          } else {
            sum += constructionSite.progressTotal - constructionSite.progress;
            ans.push(pos);
            constructions++;
          }
        } else if (structure) {
          let heal = this.getCase(structure).heal;
          if ((structure.hits < heal * 0.8 && !constructions) || structure.hits < heal * 0.3) {
            sum += Math.round((heal - structure.hits) / 100);
            ans.push(pos);
          }
        }
      }
    }
    return { pos: ans, sum: sum };
  }
}
