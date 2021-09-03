import { profile } from "./profiler/decorator";

export type RoomSetup = { [key in StructureConstant]?: { "pos": { "x": number, "y": number }[] } };

type Module = { setup: RoomSetup, freeSpaces: Pos[], exits: Pos[] }

const BASE_HORIZONTAL: Module = { exits: [{ x: 20, y: 24 }, { x: 20, y: 26 }], freeSpaces: [{ x: 25, y: 24 }, { x: 26, y: 24 }, { x: 26, y: 26 }], setup: { "road": { "pos": [{ "x": 25, "y": 25 }, { "x": 26, "y": 26 }, { "x": 24, "y": 24 }, { "x": 23, "y": 24 }, { "x": 24, "y": 23 }, { "x": 26, "y": 27 }, { "x": 27, "y": 26 }, { "x": 28, "y": 25 }, { "x": 25, "y": 22 }, { "x": 27, "y": 24 }, { "x": 26, "y": 23 }, { "x": 25, "y": 28 }, { "x": 22, "y": 25 }, { "x": 23, "y": 26 }, { "x": 24, "y": 27 }, { "x": 21, "y": 25 }, { "x": 20, "y": 24 }, { "x": 20, "y": 26 }] }, "lab": { "pos": [{ "x": 21, "y": 24 }, { "x": 22, "y": 24 }, { "x": 23, "y": 25 }, { "x": 22, "y": 26 }, { "x": 21, "y": 26 }, { "x": 20, "y": 25 }, { "x": 20, "y": 23 }, { "x": 21, "y": 23 }, { "x": 20, "y": 27 }, { "x": 21, "y": 27 }] }, "storage": { "pos": [{ "x": 25, "y": 26 }] }, "link": { "pos": [{ "x": 24, "y": 25 }] }, "terminal": { "pos": [{ "x": 24, "y": 26 }] } } };
const BASE_VERTICAL: Module = { exits: [{ x: 20, y: 21 }, { x: 20, y: 24 }, { x: 20, y: 26 }, { x: 20, y: 29 }], freeSpaces: [], setup: { "road": { "pos": [{ "x": 25, "y": 25 }, { "x": 26, "y": 26 }, { "x": 24, "y": 24 }, { "x": 23, "y": 24 }, { "x": 24, "y": 23 }, { "x": 26, "y": 27 }, { "x": 27, "y": 26 }, { "x": 28, "y": 25 }, { "x": 25, "y": 22 }, { "x": 27, "y": 24 }, { "x": 26, "y": 23 }, { "x": 25, "y": 28 }, { "x": 22, "y": 25 }, { "x": 23, "y": 26 }, { "x": 24, "y": 27 }, { "x": 21, "y": 25 }, { "x": 20, "y": 24 }, { "x": 20, "y": 26 }, { "x": 23, "y": 23 }, { "x": 22, "y": 22 }, { "x": 21, "y": 21 }, { "x": 20, "y": 21 }, { "x": 23, "y": 27 }, { "x": 22, "y": 28 }, { "x": 21, "y": 29 }, { "x": 20, "y": 29 }] }, "lab": { "pos": [{ "x": 21, "y": 24 }, { "x": 22, "y": 24 }, { "x": 23, "y": 25 }, { "x": 22, "y": 26 }, { "x": 21, "y": 26 }, { "x": 20, "y": 25 }, { "x": 20, "y": 23 }, { "x": 21, "y": 23 }, { "x": 20, "y": 27 }, { "x": 21, "y": 27 }] }, "storage": { "pos": [{ "x": 25, "y": 26 }] }, "link": { "pos": [{ "x": 24, "y": 25 }] }, "terminal": { "pos": [{ "x": 24, "y": 26 }] }, "extension": { "pos": [{ "x": 22, "y": 23 }, { "x": 20, "y": 28 }, { "x": 21, "y": 28 }, { "x": 22, "y": 27 }, { "x": 20, "y": 30 }, { "x": 21, "y": 30 }, { "x": 22, "y": 29 }, { "x": 23, "y": 28 }, { "x": 21, "y": 22 }, { "x": 20, "y": 22 }, { "x": 20, "y": 20 }, { "x": 21, "y": 20 }, { "x": 22, "y": 21 }, { "x": 23, "y": 22 }] } } };

const EXTRA_VERTICAL: Module = { exits: [{ x: 23, y: 22 }, { x: 25, y: 22 }, { x: 27, y: 22 }], freeSpaces: [], setup: { "road": { "pos": [{ "x": 25, "y": 24 }, { "x": 23, "y": 25 }, { "x": 22, "y": 24 }, { "x": 21, "y": 23 }, { "x": 27, "y": 25 }, { "x": 26, "y": 23 }, { "x": 24, "y": 23 }, { "x": 25, "y": 22 }, { "x": 27, "y": 22 }, { "x": 23, "y": 22 }, { "x": 28, "y": 24 }, { "x": 29, "y": 23 }] }, "lab": { "pos": [] }, "storage": { "pos": [] }, "link": { "pos": [] }, "terminal": { "pos": [] }, "spawn": { "pos": [{ "x": 25, "y": 26 }] }, "extension": { "pos": [{ "x": 24, "y": 25 }, { "x": 24, "y": 24 }, { "x": 26, "y": 24 }, { "x": 26, "y": 25 }, { "x": 27, "y": 24 }, { "x": 27, "y": 23 }, { "x": 28, "y": 23 }, { "x": 27, "y": 26 }, { "x": 28, "y": 26 }, { "x": 28, "y": 25 }, { "x": 29, "y": 25 }, { "x": 29, "y": 24 }, { "x": 30, "y": 24 }, { "x": 30, "y": 23 }, { "x": 30, "y": 22 }, { "x": 29, "y": 22 }, { "x": 28, "y": 22 }, { "x": 23, "y": 24 }, { "x": 23, "y": 23 }, { "x": 22, "y": 23 }, { "x": 22, "y": 22 }, { "x": 21, "y": 22 }, { "x": 20, "y": 22 }, { "x": 20, "y": 23 }, { "x": 21, "y": 24 }, { "x": 21, "y": 25 }, { "x": 22, "y": 25 }, { "x": 22, "y": 26 }, { "x": 23, "y": 26 }, { "x": 20, "y": 24 }] }, "tower": { "pos": [{ "x": 25, "y": 23 }, { "x": 24, "y": 22 }, { "x": 26, "y": 22 }] }, "rampart": { "pos": [] } } };
const EXTRA_HORIZONTAL: Module = { exits: [{ x: 20, y: 24 }, { x: 20, y: 26 }], freeSpaces: [], setup: { "road": { "pos": [{ "x": 21, "y": 25 }, { "x": 20, "y": 24 }, { "x": 20, "y": 26 }] }, "lab": { "pos": [] }, "storage": { "pos": [] }, "link": { "pos": [] }, "terminal": { "pos": [] }, "spawn": { "pos": [{ "x": 23, "y": 25 }] }, "extension": { "pos": [{ "x": 21, "y": 27 }, { "x": 21, "y": 26 }, { "x": 20, "y": 28 }, { "x": 21, "y": 24 }, { "x": 20, "y": 22 }, { "x": 21, "y": 23 }, { "x": 22, "y": 26 }, { "x": 22, "y": 24 }] }, "tower": { "pos": [{ "x": 20, "y": 23 }, { "x": 20, "y": 27 }, { "x": 20, "y": 25 }] }, "rampart": { "pos": [] } } };

const WALLS: Module = { exits: [], freeSpaces: [], setup: { "road": { "pos": [{ "x": 25, "y": 25 }, { "x": 26, "y": 26 }, { "x": 24, "y": 24 }, { "x": 23, "y": 24 }, { "x": 24, "y": 23 }, { "x": 26, "y": 27 }, { "x": 27, "y": 26 }, { "x": 28, "y": 25 }, { "x": 25, "y": 22 }, { "x": 27, "y": 24 }, { "x": 26, "y": 23 }, { "x": 25, "y": 28 }, { "x": 22, "y": 25 }, { "x": 23, "y": 26 }, { "x": 24, "y": 27 }, { "x": 21, "y": 25 }, { "x": 20, "y": 24 }, { "x": 20, "y": 26 }, { "x": 23, "y": 23 }, { "x": 22, "y": 22 }, { "x": 21, "y": 21 }, { "x": 20, "y": 21 }, { "x": 23, "y": 27 }, { "x": 22, "y": 28 }, { "x": 21, "y": 29 }, { "x": 20, "y": 29 }] }, "lab": { "pos": [{ "x": 21, "y": 24 }, { "x": 22, "y": 24 }, { "x": 23, "y": 25 }, { "x": 22, "y": 26 }, { "x": 21, "y": 26 }, { "x": 20, "y": 25 }, { "x": 20, "y": 23 }, { "x": 21, "y": 23 }, { "x": 20, "y": 27 }, { "x": 21, "y": 27 }] }, "storage": { "pos": [{ "x": 25, "y": 26 }] }, "link": { "pos": [{ "x": 24, "y": 25 }] }, "terminal": { "pos": [{ "x": 24, "y": 26 }] }, "extension": { "pos": [{ "x": 22, "y": 23 }, { "x": 20, "y": 28 }, { "x": 21, "y": 28 }, { "x": 22, "y": 27 }, { "x": 20, "y": 30 }, { "x": 21, "y": 30 }, { "x": 22, "y": 29 }, { "x": 23, "y": 28 }, { "x": 21, "y": 22 }, { "x": 20, "y": 22 }, { "x": 20, "y": 20 }, { "x": 21, "y": 20 }, { "x": 22, "y": 21 }, { "x": 23, "y": 22 }] } } };

const SPECIAL_STRUCTURE: { [key in StructureConstant]?: { [level: number]: { amount: number, heal: number } } } = {
  [STRUCTURE_ROAD]: { 0: { amount: 2500, heal: ROAD_HITS / 2 }, 1: { amount: 0, heal: ROAD_HITS / 2 }, 2: { amount: 0, heal: ROAD_HITS / 2 }, 3: { amount: 2500, heal: ROAD_HITS / 2 }, 4: { amount: 2500, heal: ROAD_HITS / 2 }, 5: { amount: 2500, heal: ROAD_HITS / 2 }, 6: { amount: 2500, heal: ROAD_HITS / 2 }, 7: { amount: 2500, heal: ROAD_HITS / 2 }, 8: { amount: 2500, heal: ROAD_HITS } },
  [STRUCTURE_WALL]: { 0: { amount: 0, heal: 0 }, 1: { amount: 0, heal: 10000 }, 2: { amount: 2500, heal: 10000 }, 3: { amount: 2500, heal: 10000 }, 4: { amount: 2500, heal: 100000 }, 5: { amount: 2500, heal: 100000 }, 6: { amount: 2500, heal: 500000 }, 7: { amount: 2500, heal: 500000 }, 8: { amount: 2500, heal: 2000000 } },
  [STRUCTURE_RAMPART]: { 0: { amount: 0, heal: 0 }, 1: { amount: 0, heal: 10000 }, 2: { amount: 2500, heal: 10000 }, 3: { amount: 2500, heal: 10000 }, 4: { amount: 2500, heal: 100000 }, 5: { amount: 2500, heal: 100000 }, 6: { amount: 2500, heal: 500000 }, 7: { amount: 2500, heal: 500000 }, 8: { amount: 2500, heal: 2000000 } }
}
type Pos = { x: number, y: number };

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
      plan: { [id: number]: { [id: number]: { s: StructureConstant | undefined, r: boolean } } },
      placed: { [key in StructureConstant]?: number },
      freeSpaces: Pos[], exits: RoomPosition[],
      jobsToDo: (() => void | -1)[];
    }
  } = {};

  run() {
    // CPU for planner - least important one
    for (let roomName in this.activePlanning) {
      while (this.activePlanning[roomName].jobsToDo.length) {
        if (this.activePlanning[roomName].jobsToDo[0]() !== -1)
          this.activePlanning[roomName].jobsToDo.shift();
      }
    }
  }
  generatePlan(anchor: RoomPosition) {
    this.activePlanning[anchor.roomName] = { plan: [], placed: {}, freeSpaces: [], exits: [], jobsToDo: [] };
    for (let t in CONSTRUCTION_COST)
      this.activePlanning[anchor.roomName].placed[<BuildableStructureConstant>t] = 0;

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

    let baseRotation: 0 | 1 | 2 | 3 = <0 | 1 | 2 | 3>(2 % 4);
    jobs.push(() => this.addToPlan(anchor, baseRotation > 1 ? BASE_VERTICAL : BASE_HORIZONTAL, (a: Pos) => rotate(a, baseRotation)));
    if (baseRotation != 2)
      jobs.push(() => this.addToPlan(anchor, EXTRA_VERTICAL, (a: Pos) => rotate(a, 0, -3))); // top
    if (baseRotation != 3)
      jobs.push(() => this.addToPlan(anchor, EXTRA_VERTICAL, (a: Pos) => rotate(a, 1, 3))); // bottom
    if (baseRotation != 1)
      jobs.push(() => this.addToPlan(anchor, EXTRA_HORIZONTAL, (a: Pos) => rotate(a, 1, 0))); // right
    if (baseRotation != 0)
      jobs.push(() => this.addToPlan(anchor, EXTRA_HORIZONTAL, (a: Pos) => rotate(a, 0))); // left


    let pathArgs: FindPathOpts = {
      costCallback: function(roomName: string, costMatrix: CostMatrix): CostMatrix | void {
        if (Apiary.planner.activePlanning[roomName]) {
          let plan = Apiary.planner.activePlanning[roomName].plan;
          for (let x in plan)
            for (let y in plan[x]) {
              if (plan[x][y].s == STRUCTURE_ROAD)
                costMatrix.set(+x, +y, 1);
              else if (plan[x][y].s)
                costMatrix.set(+x, +y, 255);
            }
          return costMatrix;
        }
      }, plainCost: 2, swampCost: 10, ignoreCreeps: true,
    }

    let futureResourceCells = _.filter(Game.flags, (f) => f.color == COLOR_YELLOW && f.memory.hive == anchor.roomName);
    _.forEach(futureResourceCells, (f) => {
      if (f.color == COLOR_CYAN) {

      }
      jobs.push(() => {
        let plan = this.activePlanning[anchor.roomName].plan;
        let exit = f.pos.findClosestByPath(this.activePlanning[anchor.roomName].exits, pathArgs);
        if (!exit)
          exit = f.pos.findClosest(this.activePlanning[anchor.roomName].exits);
        if (exit) {
          let path = exit.findPathTo(f.pos);
          console.log(f.pos, path.length && [path[0].x, path[0].y])
          path.pop();
          if (f.pos.roomName == exit.roomName) {
            let container: Pos;
            if (path.length > 1)
              container = path[path.length - 2];
            else if (path.length > 0)
              container = path[0];
            else
              container = f.pos.getOpenPositions(true)[0];

            if (container) {
              if (!plan[container.x])
                plan[container.x] = {};
              if (!plan[container.x][container.y])
                plan[container.x][container.y] = { s: undefined, r: false };
              if (plan[container.x][container.y].s)
                this.activePlanning[anchor.roomName].placed[plan[container.x][container.y].s!]!--;
              plan[container.x][container.y] = { s: STRUCTURE_CONTAINER, r: plan[container.x][container.y].r };
            }
            path.pop(); path.pop();
          }
          _.forEach(path, (pos) => {
            if (!plan[pos.x])
              plan[pos.x] = {};
            if (!plan[pos.x][pos.y])
              plan[pos.x][pos.y] = { s: undefined, r: false };
            if (!plan[pos.x][pos.y].s)
              plan[pos.x][pos.y] = { s: STRUCTURE_ROAD, r: plan[pos.x][pos.y].r };
          });
        }
      });
    });

    jobs.push(() => this.addToPlan(anchor, WALLS, (a: Pos) => rotate(a, baseRotation)));

    jobs.push(() => {
      let plan = this.activePlanning[anchor.roomName].plan;
      _.forEach([STRUCTURE_EXTENSION, STRUCTURE_OBSERVER], (sType) => {
        if (this.activePlanning[anchor.roomName].placed[sType]! < CONTROLLER_STRUCTURES[sType][8]) {
          let pos: Pos | undefined;
          while (pos = this.activePlanning[anchor.roomName].freeSpaces.shift()) {
            if (!plan[pos.x])
              plan[pos.x] = {};
            if (!plan[pos.x][pos.y])
              plan[pos.x][pos.y] = { s: undefined, r: false };
            if (!plan[pos.x][pos.y].s)
              break;
            if (pos)
              plan[pos.x][pos.y] = { s: sType, r: false };
          }
        }
      });
    });
  }

  addToPlan(anchor: { x: number, y: number, roomName: string }, configuration: Module, transformPos: (a: Pos) => Pos) {
    this.activePlanning[anchor.roomName].freeSpaces = this.activePlanning[anchor.roomName].freeSpaces
      .concat(_.map(configuration.freeSpaces, (p) => transformPos(p)));

    this.activePlanning[anchor.roomName].exits = this.activePlanning[anchor.roomName].exits
      .concat(_.map(configuration.exits, (p) => {
        let ans = transformPos(p);
        return new RoomPosition(ans.x, ans.y, anchor.roomName);
      }));

    let plan = this.activePlanning[anchor.roomName].plan;
    let placed = this.activePlanning[anchor.roomName].placed;
    let terrain = Game.map.getRoomTerrain(anchor.roomName);
    for (let t in configuration.setup) {
      let sType = <BuildableStructureConstant>t;
      let poss = configuration.setup[sType]!.pos;
      for (let i = 0; i < poss.length; ++i) {
        let ans = transformPos(poss[i]);
        let x = ans.x;
        let y = ans.y;
        if (!plan[x])
          plan[x] = {};
        if (!plan[x][y])
          plan[x][y] = { s: undefined, r: false };
        if (placed[sType]! < CONTROLLER_STRUCTURES[sType][8]) {
          if (terrain.get(x, y) != TERRAIN_MASK_WALL) {
            if (sType == STRUCTURE_RAMPART) {
              plan[x][y] = { s: plan[x][y].s, r: true };
            } else if (!plan[x][y].s) {
              plan[x][y] = { s: sType, r: plan[x][y].r };
              placed[sType]!++;
            } else if (sType == STRUCTURE_WALL)
              plan[x][y] = { s: plan[x][y].s, r: true };
          }
        } else
          this.activePlanning[anchor.roomName].freeSpaces.push(ans);
      }
    }
  }

  toActive(roomName: string) {
    this.activePlanning[roomName] = { plan: [], placed: {}, freeSpaces: [], exits: [], jobsToDo: [] };
    let plan = this.activePlanning[roomName].plan;
    for (let t in Memory.cache.roomPlanner[roomName]) {
      let sType = <BuildableStructureConstant>t;
      let poss = Memory.cache.roomPlanner[roomName][sType]!.pos;
      for (let i = 0; i < poss.length; ++i) {
        let x = poss[i].x;
        let y = poss[i].y;
        if (!plan[x])
          plan[x] = {};
        if (!plan[x][y])
          plan[x][y] = { s: undefined, r: false };
        if (sType == STRUCTURE_RAMPART) {
          plan[x][y] = { s: plan[x][y].s, r: true };
        } else {
          plan[x][y] = { s: sType, r: plan[x][y].r };
        }
      }
    }
  }

  resetPlanner(roomName: string) {
    if (!(roomName in Game.rooms))
      return;

    Memory.cache.roomPlanner[roomName] = {};
    _.forEach((<(Structure | ConstructionSite)[]>Game.rooms[roomName].find(FIND_STRUCTURES))
      .concat(Game.rooms[roomName].find(FIND_CONSTRUCTION_SITES)),
      (s) => {
        if (!(s.structureType in CONTROLLER_STRUCTURES))
          return;
        if (this.getCase(s).amount == 0)
          return;
        if (!Memory.cache.roomPlanner[roomName][s.structureType])
          Memory.cache.roomPlanner[roomName][s.structureType] = { "pos": [] };
        Memory.cache.roomPlanner[roomName][s.structureType]!.pos.push({ x: s.pos.x, y: s.pos.y });
      });
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
          (s) => s.structureType == sType)[0];
        if (!structure) {
          if (constructions <= 5) {
            let constructionSite = _.filter(pos.lookFor(LOOK_CONSTRUCTION_SITES), (s) => s.structureType == sType)[0];
            if (!constructionSite) {
              sum += CONSTRUCTION_COST[sType];
              pos.createConstructionSite(sType);
            } else
              sum += constructionSite.progressTotal - constructionSite.progress;
            ans.push(pos);
            constructions++;
          }
        } else if (structure) {
          let heal = this.getCase(structure).heal;
          if (structure.hits < heal * 0.8) {
            sum += Math.round((heal - structure.hits) / 100);
            ans.push(pos);
          }
        }
      }
    }
    return { pos: ans, sum: sum };
  }
}
