import { profile } from "./profiler/decorator";

export type RoomSetup = { [key in StructureConstant]?: { "pos": { "x": number, "y": number }[] } };

const BASE: RoomSetup = { "storage": { "pos": [{ "x": 22, "y": 27 }] }, "road": { "pos": [{ "x": 24, "y": 25 }, { "x": 23, "y": 24 }, { "x": 24, "y": 27 }, { "x": 23, "y": 28 }, { "x": 24, "y": 23 }, { "x": 25, "y": 22 }, { "x": 26, "y": 21 }, { "x": 26, "y": 26 }, { "x": 27, "y": 25 }, { "x": 28, "y": 24 }, { "x": 29, "y": 23 }, { "x": 24, "y": 29 }, { "x": 25, "y": 30 }, { "x": 26, "y": 31 }, { "x": 27, "y": 27 }, { "x": 28, "y": 28 }, { "x": 29, "y": 29 }, { "x": 20, "y": 27 }, { "x": 20, "y": 25 }, { "x": 21, "y": 24 }, { "x": 20, "y": 23 }, { "x": 19, "y": 22 }, { "x": 18, "y": 21 }, { "x": 20, "y": 29 }, { "x": 19, "y": 30 }, { "x": 18, "y": 31 }, { "x": 25, "y": 26 }, { "x": 19, "y": 26 }, { "x": 22, "y": 23 }, { "x": 22, "y": 22 }, { "x": 22, "y": 29 }, { "x": 22, "y": 30 }, { "x": 21, "y": 28 }, { "x": 18, "y": 26 }, { "x": 17, "y": 25 }, { "x": 17, "y": 27 }, { "x": 16, "y": 28 }, { "x": 21, "y": 31 }, { "x": 20, "y": 32 }, { "x": 20, "y": 33 }, { "x": 23, "y": 31 }, { "x": 24, "y": 32 }, { "x": 24, "y": 33 }, { "x": 22, "y": 32 }, { "x": 22, "y": 33 }, { "x": 16, "y": 26 }, { "x": 16, "y": 24 }, { "x": 20, "y": 19 }, { "x": 20, "y": 20 }, { "x": 21, "y": 21 }, { "x": 22, "y": 20 }, { "x": 23, "y": 21 }, { "x": 24, "y": 20 }, { "x": 24, "y": 19 }, { "x": 22, "y": 19 }, { "x": 28, "y": 26 }, { "x": 19, "y": 34 }, { "x": 19, "y": 35 }, { "x": 22, "y": 34 }, { "x": 22, "y": 35 }, { "x": 25, "y": 34 }, { "x": 25, "y": 35 }, { "x": 30, "y": 29 }, { "x": 29, "y": 26 }, { "x": 30, "y": 26 }, { "x": 30, "y": 23 }, { "x": 25, "y": 18 }, { "x": 25, "y": 17 }, { "x": 22, "y": 18 }, { "x": 22, "y": 17 }, { "x": 19, "y": 18 }, { "x": 19, "y": 17 }, { "x": 15, "y": 23 }, { "x": 14, "y": 23 }, { "x": 15, "y": 26 }, { "x": 14, "y": 26 }, { "x": 15, "y": 29 }, { "x": 14, "y": 29 }, { "x": 21, "y": 25 }, { "x": 22, "y": 26 }, { "x": 23, "y": 27 }] }, "link": { "pos": [{ "x": 21, "y": 26 }] }, "tower": { "pos": [{ "x": 21, "y": 32 }, { "x": 23, "y": 32 }, { "x": 21, "y": 20 }, { "x": 23, "y": 20 }, { "x": 22, "y": 31 }, { "x": 22, "y": 21 }] }, "factory": { "pos": [] }, "terminal": { "pos": [{ "x": 21, "y": 27 }] }, "lab": { "pos": [{ "x": 17, "y": 26 }, { "x": 17, "y": 24 }, { "x": 18, "y": 24 }, { "x": 18, "y": 25 }, { "x": 19, "y": 25 }, { "x": 19, "y": 27 }, { "x": 18, "y": 27 }, { "x": 18, "y": 28 }, { "x": 17, "y": 28 }, { "x": 20, "y": 26 }] }, "nuker": { "pos": [] }, "extension": { "pos": [{ "x": 24, "y": 24 }, { "x": 25, "y": 24 }, { "x": 25, "y": 23 }, { "x": 26, "y": 23 }, { "x": 26, "y": 22 }, { "x": 27, "y": 22 }, { "x": 27, "y": 21 }, { "x": 27, "y": 20 }, { "x": 26, "y": 20 }, { "x": 25, "y": 20 }, { "x": 25, "y": 21 }, { "x": 24, "y": 21 }, { "x": 24, "y": 22 }, { "x": 23, "y": 22 }, { "x": 23, "y": 23 }, { "x": 25, "y": 28 }, { "x": 25, "y": 29 }, { "x": 26, "y": 29 }, { "x": 26, "y": 30 }, { "x": 27, "y": 30 }, { "x": 27, "y": 31 }, { "x": 23, "y": 29 }, { "x": 23, "y": 30 }, { "x": 24, "y": 30 }, { "x": 24, "y": 31 }, { "x": 25, "y": 31 }, { "x": 25, "y": 32 }, { "x": 26, "y": 32 }, { "x": 27, "y": 32 }, { "x": 21, "y": 23 }, { "x": 20, "y": 22 }, { "x": 19, "y": 21 }, { "x": 18, "y": 20 }, { "x": 17, "y": 20 }, { "x": 17, "y": 21 }, { "x": 17, "y": 22 }, { "x": 18, "y": 22 }, { "x": 18, "y": 23 }, { "x": 19, "y": 23 }, { "x": 19, "y": 24 }, { "x": 21, "y": 22 }, { "x": 20, "y": 21 }, { "x": 19, "y": 20 }, { "x": 21, "y": 29 }, { "x": 20, "y": 30 }, { "x": 19, "y": 29 }, { "x": 18, "y": 30 }, { "x": 17, "y": 31 }, { "x": 18, "y": 32 }, { "x": 19, "y": 31 }, { "x": 20, "y": 31 }, { "x": 17, "y": 32 }, { "x": 17, "y": 30 }, { "x": 18, "y": 29 }, { "x": 19, "y": 28 }, { "x": 21, "y": 30 }, { "x": 20, "y": 28 }, { "x": 24, "y": 28 }, { "x": 20, "y": 24 }, { "x": 19, "y": 32 }] }, "powerSpawn": { "pos": [] }, "spawn": { "pos": [{ "x": 22, "y": 28 }, { "x": 22, "y": 24 }, { "x": 24, "y": 26 }] }, "rampart": { "pos": [{ "x": 16, "y": 28 }, { "x": 16, "y": 24 }, { "x": 20, "y": 33 }, { "x": 22, "y": 33 }, { "x": 24, "y": 33 }, { "x": 16, "y": 26 }, { "x": 28, "y": 26 }, { "x": 28, "y": 28 }, { "x": 28, "y": 24 }, { "x": 24, "y": 19 }, { "x": 22, "y": 19 }, { "x": 20, "y": 19 }, { "x": 21, "y": 20 }, { "x": 23, "y": 20 }, { "x": 21, "y": 32 }, { "x": 23, "y": 32 }, { "x": 30, "y": 26 }, { "x": 30, "y": 23 }, { "x": 30, "y": 29 }, { "x": 22, "y": 17 }, { "x": 25, "y": 17 }, { "x": 19, "y": 17 }, { "x": 14, "y": 26 }, { "x": 14, "y": 23 }, { "x": 14, "y": 29 }, { "x": 25, "y": 35 }, { "x": 22, "y": 35 }, { "x": 19, "y": 35 }, { "x": 22, "y": 34 }, { "x": 25, "y": 34 }, { "x": 19, "y": 34 }, { "x": 15, "y": 29 }, { "x": 15, "y": 26 }, { "x": 15, "y": 23 }, { "x": 19, "y": 18 }, { "x": 22, "y": 18 }, { "x": 25, "y": 18 }, { "x": 29, "y": 29 }, { "x": 29, "y": 26 }, { "x": 29, "y": 23 }, { "x": 22, "y": 31 }, { "x": 22, "y": 21 }] }, "observer": { "pos": [{ "x": 17, "y": 23 }] }, "constructedWall": { "pos": [{ "x": 16, "y": 29 }, { "x": 16, "y": 30 }, { "x": 16, "y": 31 }, { "x": 16, "y": 32 }, { "x": 17, "y": 33 }, { "x": 18, "y": 33 }, { "x": 19, "y": 33 }, { "x": 25, "y": 33 }, { "x": 26, "y": 33 }, { "x": 27, "y": 33 }, { "x": 16, "y": 33 }, { "x": 28, "y": 33 }, { "x": 28, "y": 32 }, { "x": 28, "y": 31 }, { "x": 28, "y": 30 }, { "x": 28, "y": 29 }, { "x": 28, "y": 25 }, { "x": 28, "y": 23 }, { "x": 28, "y": 22 }, { "x": 28, "y": 21 }, { "x": 28, "y": 20 }, { "x": 28, "y": 19 }, { "x": 27, "y": 19 }, { "x": 26, "y": 19 }, { "x": 25, "y": 19 }, { "x": 23, "y": 19 }, { "x": 21, "y": 19 }, { "x": 19, "y": 19 }, { "x": 18, "y": 19 }, { "x": 17, "y": 19 }, { "x": 16, "y": 19 }, { "x": 16, "y": 20 }, { "x": 16, "y": 21 }, { "x": 16, "y": 22 }, { "x": 16, "y": 23 }, { "x": 28, "y": 27 }, { "x": 14, "y": 34 }, { "x": 14, "y": 32 }, { "x": 14, "y": 31 }, { "x": 14, "y": 33 }, { "x": 14, "y": 35 }, { "x": 14, "y": 28 }, { "x": 14, "y": 30 }, { "x": 14, "y": 27 }, { "x": 14, "y": 24 }, { "x": 14, "y": 22 }, { "x": 14, "y": 25 }, { "x": 14, "y": 20 }, { "x": 14, "y": 19 }, { "x": 14, "y": 21 }, { "x": 14, "y": 18 }, { "x": 15, "y": 17 }, { "x": 16, "y": 17 }, { "x": 17, "y": 17 }, { "x": 18, "y": 17 }, { "x": 14, "y": 17 }, { "x": 21, "y": 17 }, { "x": 23, "y": 17 }, { "x": 20, "y": 17 }, { "x": 26, "y": 17 }, { "x": 27, "y": 17 }, { "x": 24, "y": 17 }, { "x": 29, "y": 17 }, { "x": 30, "y": 17 }, { "x": 28, "y": 17 }, { "x": 30, "y": 19 }, { "x": 30, "y": 20 }, { "x": 30, "y": 18 }, { "x": 30, "y": 24 }, { "x": 30, "y": 25 }, { "x": 30, "y": 21 }, { "x": 30, "y": 22 }, { "x": 30, "y": 28 }, { "x": 30, "y": 30 }, { "x": 30, "y": 32 }, { "x": 30, "y": 33 }, { "x": 30, "y": 27 }, { "x": 30, "y": 31 }, { "x": 30, "y": 35 }, { "x": 30, "y": 34 }, { "x": 23, "y": 33 }, { "x": 21, "y": 33 }, { "x": 16, "y": 25 }, { "x": 16, "y": 27 }, { "x": 15, "y": 35 }, { "x": 16, "y": 35 }, { "x": 17, "y": 35 }, { "x": 18, "y": 35 }, { "x": 20, "y": 35 }, { "x": 21, "y": 35 }, { "x": 23, "y": 35 }, { "x": 24, "y": 35 }, { "x": 26, "y": 35 }, { "x": 27, "y": 35 }, { "x": 28, "y": 35 }, { "x": 29, "y": 35 }] } };


@profile
export class RoomPlanner {
  activePlanning: { [id: string]: { [id: number]: { [id: number]: { s: StructureConstant | undefined, r: boolean } } } } = {};
  generatePlan(anchor: RoomPosition) {
    let terrain = Game.map.getRoomTerrain(anchor.roomName);
    this.activePlanning[anchor.roomName] = [];
    let plan = this.activePlanning[anchor.roomName];
    let diff = {
      x: anchor.x - BASE[STRUCTURE_STORAGE]!.pos[0].x,
      y: anchor.y - BASE[STRUCTURE_STORAGE]!.pos[0].y,
    };
    let missing: { [key in StructureConstant]?: number } = {};
    for (let t in BASE) {
      let sType = <BuildableStructureConstant>t;
      let poss = BASE[sType]!.pos;
      for (let i = 0; i < poss.length; ++i) {
        let x = poss[i].x + diff.x;
        let y = poss[i].y + diff.y;
        if (!plan[x])
          plan[x] = [];
        if (terrain.get(x, y) != TERRAIN_MASK_WALL) {
          if (sType == STRUCTURE_RAMPART) {
            if (!plan[x][y])
              plan[x][y] = { s: undefined, r: true };
            else
              plan[x][y] = { s: plan[x][y].s, r: true };
          } else {
            if (!plan[x][y])
              plan[x][y] = { s: sType, r: false };
            else if (!plan[x][y].s)
              plan[x][y] = { s: sType, r: plan[x][y].r };
            else {
              if (!missing[sType])
                missing[sType] = 0;
              missing[sType]!++;
            }
          }
        } else {
          if (!missing[sType])
            missing[sType] = 0;
          missing[sType]!++;
        }
      }
    }

    console.log(missing);
  }

  visualize() {
    for (let roomName in this.activePlanning) {
      let vis = new RoomVisual(roomName);
      for (let x in this.activePlanning[roomName])
        for (let y in this.activePlanning[roomName][x]) {
          let style: CircleStyle = {
            opacity: 0.6,
            radius: 0.4
          };
          switch (this.activePlanning[roomName][x][y].s) {
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
            default:
              style.fill = "#1823FF";
              break;
          }
          vis.circle(+x, +y, style);
          if (this.activePlanning[roomName][x][y].r) {
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
    if (!Memory.cache.roomPlaner[roomName])
      Memory.cache.roomPlaner[roomName] = {};

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
