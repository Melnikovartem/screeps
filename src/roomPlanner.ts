import { profile } from "./profiler/decorator";

export type RoomSetup = { [key in StructureConstant]?: { "pos": { "x": number, "y": number }[] } };

type Module = { setup: RoomSetup, freeSpaces: Pos[], exits: Pos[] }

const BASE_HORIZONTAL: Module = { exits: [{ x: 20, y: 24 }, { x: 20, y: 26 }], freeSpaces: [{ x: 25, y: 24 }, { x: 26, y: 24 }, { x: 26, y: 26 }], setup: { "road": { "pos": [{ "x": 25, "y": 25 }, { "x": 26, "y": 26 }, { "x": 24, "y": 24 }, { "x": 23, "y": 24 }, { "x": 24, "y": 23 }, { "x": 26, "y": 27 }, { "x": 27, "y": 26 }, { "x": 28, "y": 25 }, { "x": 25, "y": 22 }, { "x": 27, "y": 24 }, { "x": 26, "y": 23 }, { "x": 25, "y": 28 }, { "x": 22, "y": 25 }, { "x": 23, "y": 26 }, { "x": 24, "y": 27 }, { "x": 21, "y": 25 }, { "x": 20, "y": 24 }, { "x": 20, "y": 26 }] }, "lab": { "pos": [{ "x": 21, "y": 24 }, { "x": 22, "y": 24 }, { "x": 23, "y": 25 }, { "x": 22, "y": 26 }, { "x": 21, "y": 26 }, { "x": 20, "y": 25 }, { "x": 20, "y": 23 }, { "x": 21, "y": 23 }, { "x": 20, "y": 27 }, { "x": 21, "y": 27 }] }, "storage": { "pos": [{ "x": 25, "y": 26 }] }, "link": { "pos": [{ "x": 24, "y": 25 }] }, "terminal": { "pos": [{ "x": 24, "y": 26 }] } } };
const BASE_VERTICAL: Module = { exits: [{ x: 20, y: 21 }, { x: 20, y: 24 }, { x: 20, y: 26 }, { x: 20, y: 29 }], freeSpaces: [], setup: { "road": { "pos": [{ "x": 25, "y": 25 }, { "x": 26, "y": 26 }, { "x": 24, "y": 24 }, { "x": 23, "y": 24 }, { "x": 24, "y": 23 }, { "x": 26, "y": 27 }, { "x": 27, "y": 26 }, { "x": 28, "y": 25 }, { "x": 25, "y": 22 }, { "x": 27, "y": 24 }, { "x": 26, "y": 23 }, { "x": 25, "y": 28 }, { "x": 22, "y": 25 }, { "x": 23, "y": 26 }, { "x": 24, "y": 27 }, { "x": 21, "y": 25 }, { "x": 20, "y": 24 }, { "x": 20, "y": 26 }, { "x": 23, "y": 23 }, { "x": 22, "y": 22 }, { "x": 21, "y": 21 }, { "x": 20, "y": 21 }, { "x": 23, "y": 27 }, { "x": 22, "y": 28 }, { "x": 21, "y": 29 }, { "x": 20, "y": 29 }] }, "lab": { "pos": [{ "x": 21, "y": 24 }, { "x": 22, "y": 24 }, { "x": 23, "y": 25 }, { "x": 22, "y": 26 }, { "x": 21, "y": 26 }, { "x": 20, "y": 25 }, { "x": 20, "y": 23 }, { "x": 21, "y": 23 }, { "x": 20, "y": 27 }, { "x": 21, "y": 27 }] }, "storage": { "pos": [{ "x": 25, "y": 26 }] }, "link": { "pos": [{ "x": 24, "y": 25 }] }, "terminal": { "pos": [{ "x": 24, "y": 26 }] }, "extension": { "pos": [{ "x": 22, "y": 23 }, { "x": 20, "y": 28 }, { "x": 21, "y": 28 }, { "x": 22, "y": 27 }, { "x": 20, "y": 30 }, { "x": 21, "y": 30 }, { "x": 22, "y": 29 }, { "x": 23, "y": 28 }, { "x": 21, "y": 22 }, { "x": 20, "y": 22 }, { "x": 20, "y": 20 }, { "x": 21, "y": 20 }, { "x": 22, "y": 21 }, { "x": 23, "y": 22 }] } } };

const EXTRA_VERTICAL: Module = { exits: [{ x: 23, y: 22 }, { x: 25, y: 22 }, { x: 27, y: 22 }], freeSpaces: [], setup: { "road": { "pos": [{ "x": 25, "y": 24 }, { "x": 23, "y": 25 }, { "x": 22, "y": 24 }, { "x": 21, "y": 23 }, { "x": 27, "y": 25 }, { "x": 26, "y": 23 }, { "x": 24, "y": 23 }, { "x": 25, "y": 22 }, { "x": 27, "y": 22 }, { "x": 23, "y": 22 }, { "x": 28, "y": 24 }, { "x": 29, "y": 23 }] }, "lab": { "pos": [] }, "storage": { "pos": [] }, "link": { "pos": [] }, "terminal": { "pos": [] }, "spawn": { "pos": [{ "x": 25, "y": 26 }] }, "extension": { "pos": [{ "x": 24, "y": 25 }, { "x": 24, "y": 24 }, { "x": 26, "y": 24 }, { "x": 26, "y": 25 }, { "x": 27, "y": 24 }, { "x": 27, "y": 23 }, { "x": 28, "y": 23 }, { "x": 27, "y": 26 }, { "x": 28, "y": 26 }, { "x": 28, "y": 25 }, { "x": 29, "y": 25 }, { "x": 29, "y": 24 }, { "x": 30, "y": 24 }, { "x": 30, "y": 23 }, { "x": 30, "y": 22 }, { "x": 29, "y": 22 }, { "x": 28, "y": 22 }, { "x": 23, "y": 24 }, { "x": 23, "y": 23 }, { "x": 22, "y": 23 }, { "x": 22, "y": 22 }, { "x": 21, "y": 22 }, { "x": 20, "y": 22 }, { "x": 20, "y": 23 }, { "x": 21, "y": 24 }, { "x": 21, "y": 25 }, { "x": 22, "y": 25 }, { "x": 22, "y": 26 }, { "x": 23, "y": 26 }, { "x": 20, "y": 24 }] }, "tower": { "pos": [{ "x": 25, "y": 23 }, { "x": 24, "y": 22 }, { "x": 26, "y": 22 }] }, "rampart": { "pos": [] } } };
const EXTRA_HORIZONTAL: Module = { exits: [{ x: 20, y: 24 }, { x: 20, y: 26 }], freeSpaces: [], setup: { "road": { "pos": [{ "x": 21, "y": 25 }, { "x": 20, "y": 24 }, { "x": 20, "y": 26 }] }, "lab": { "pos": [] }, "storage": { "pos": [] }, "link": { "pos": [] }, "terminal": { "pos": [] }, "spawn": { "pos": [{ "x": 23, "y": 25 }] }, "extension": { "pos": [{ "x": 21, "y": 27 }, { "x": 21, "y": 26 }, { "x": 20, "y": 28 }, { "x": 21, "y": 24 }, { "x": 20, "y": 22 }, { "x": 21, "y": 23 }, { "x": 22, "y": 26 }, { "x": 22, "y": 24 }] }, "tower": { "pos": [{ "x": 20, "y": 23 }, { "x": 20, "y": 27 }, { "x": 20, "y": 25 }] }, "rampart": { "pos": [] } } };

type Pos = { x: number, y: number };

@profile
export class RoomPlanner {
  activePlanning: {
    [id: string]: {
      plan: { [id: number]: { [id: number]: { s: StructureConstant | undefined, r: boolean } } },
      placed: { [key in StructureConstant]?: number },
      freeSpaces: Pos[], exits: RoomPosition[],
    }
  } = {};
  generatePlan(anchor: RoomPosition) {
    Memory.cache.roomPlaner[anchor.roomName] = {};
    this.activePlanning[anchor.roomName] = { plan: [], placed: {}, freeSpaces: [], exits: [] };
    for (let t in CONSTRUCTION_COST)
      this.activePlanning[anchor.roomName].placed[<BuildableStructureConstant>t] = 0;

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
    this.addToPlan(anchor, baseRotation > 1 ? BASE_VERTICAL : BASE_HORIZONTAL, (a: Pos) => rotate(a, baseRotation));
    if (baseRotation != 2)
      this.addToPlan(anchor, EXTRA_VERTICAL, (a: Pos) => rotate(a, 0, -3)); // top
    if (baseRotation != 3)
      this.addToPlan(anchor, EXTRA_VERTICAL, (a: Pos) => rotate(a, 1, 3)); // bottom
    if (baseRotation != 1)
      this.addToPlan(anchor, EXTRA_HORIZONTAL, (a: Pos) => rotate(a, 1, 0)); // right
    if (baseRotation != 0)
      this.addToPlan(anchor, EXTRA_HORIZONTAL, (a: Pos) => rotate(a, 0)); // left


    let placed = this.activePlanning[anchor.roomName].placed;
    let plan = this.activePlanning[anchor.roomName].plan;
    _.forEach([STRUCTURE_EXTENSION, STRUCTURE_OBSERVER], (sType) => {
      if (placed[sType]! < CONTROLLER_STRUCTURES[sType][8]) {
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

    let pathArgs = {
      costCallback: function(roomName: string, costMatrix: CostMatrix) {
        if (roomName == anchor.roomName) {
          for (let x in plan)
            for (let y in plan) {
              if (plan[x][y].s == STRUCTURE_ROAD)
                costMatrix.set(+x, +y, 1);
              else if (plan[x][y].s)
                costMatrix.set(+x, +y, 255);
            }
        }
      }, plainCost: 3, swampCost: 12,
    }

    let futureResourceCells = _.filter(Game.flags, (f) => f.color == COLOR_YELLOW && f.memory.hive == anchor.roomName);
    _.forEach(futureResourceCells, (f) => {
      let exit = f.pos.findClosestByPath(this.activePlanning[anchor.roomName].exits, pathArgs);
      if (exit) {
        let path = f.pos.findPathTo(exit, pathArgs);
        let container: Pos;
        if (path.length > 1)
          container = path[1];
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
            placed[plan[container.x][container.y].s!]!--;
          plan[container.x][container.y] = { s: STRUCTURE_CONTAINER, r: plan[container.x][container.y].r };
        }

        path.shift(); path.shift();
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
  }

  addToPlan(anchor: { x: number, y: number, roomName: string }, configuration: Module, transformPos: (a: Pos) => Pos
    , ignore: BuildableStructureConstant[] = []) {
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
          if (terrain.get(x, y) != TERRAIN_MASK_WALL && !ignore.includes(sType)) {
            if (sType == STRUCTURE_RAMPART) {
              plan[x][y] = { s: plan[x][y].s, r: true };
            } else if (!plan[x][y].s) {
              plan[x][y] = { s: sType, r: plan[x][y].r };
              placed[sType]!++;
            } else if (sType == STRUCTURE_WALL)
              plan[x][y] = { s: plan[x][y].s, r: true };
          }
        }
        else
          this.activePlanning[anchor.roomName].freeSpaces.push(ans);
      }
    }
  }

  visualize() {
    for (let roomName in this.activePlanning) {
      let vis = new RoomVisual(roomName);
      for (let x in this.activePlanning[roomName].plan)
        for (let y in this.activePlanning[roomName].plan[+x]) {
          let style: CircleStyle = {
            opacity: 0.6,
            radius: 0.4
          };
          switch (this.activePlanning[roomName].plan[+x][+y].s) {
            case STRUCTURE_ROAD:
              style.fill = "#B0B0B0";
              style.radius = 0.1;
              break;
            case STRUCTURE_WALL:
              style.fill = "#333433";
              style.opacity = 1;
              break;
            case STRUCTURE_EXTENSION:
              style.fill = "#ffdd80";
              break;
            case STRUCTURE_LAB:
              style.fill = "#91EFD8";
              break;
            case STRUCTURE_TOWER:
              style.fill = "#F93274";
              break;
            case undefined:
              style.opacity = 0;
              break;
            default:
              style.fill = "#1823FF";
              break;
          }
          vis.circle(+x, +y, style);
          if (this.activePlanning[roomName].plan[+x][+y].r) {
            vis.circle(+x, +y, {
              opacity: 0.3,
              fill: "#A1FF80",
              radius: 0.2,
            });
          }
        }
    }
  }

  checkBuildings(roomName: string) {
    if (!(roomName in Game.rooms))
      return { pos: [], sum: 0 };

    let controller: StructureController | { level: number } | undefined = Game.rooms[roomName].controller;
    if (!controller)
      controller = { level: 0 };


    let ans: RoomPosition[] = [];
    let sum = 0;
    let constructions = 0;
    for (let t in Memory.cache.roomPlaner[roomName]) {
      let sType = <BuildableStructureConstant>t;
      let positions = Memory.cache.roomPlaner[roomName][sType]!.pos;
      for (let i = 0; i < CONTROLLER_STRUCTURES[sType][controller.level] && i < positions.length; ++i) {
        let pos = new RoomPosition(positions[i].x, positions[i].y, roomName);
        let structure = <Structure<BuildableStructureConstant> | undefined>_.filter(pos.lookFor(LOOK_STRUCTURES),
          (s) => s.structureType == sType)[0];
        if (!structure && (sType == STRUCTURE_RAMPART || _.filter(pos.lookFor(LOOK_STRUCTURES)).length == 0)) {
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
        } else if (structure && structure.hits < structure.hitsMax) {
          sum += structure.hitsMax - structure.hits;
          ans.push(pos);
        }
      }
    }
    return { pos: ans, sum: sum };
  }
}
