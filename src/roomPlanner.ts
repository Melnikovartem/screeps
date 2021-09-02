import { profile } from "./profiler/decorator";


@profile
export class RoomPlanner {
  generatePlan(roomName: string) {

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
    for (let t in CONSTRUCTION_COST) {
      let type = <BuildableStructureConstant>t;
      let positions = Memory.cache.roomPlaner[roomName][type];
      if (positions)
        for (let i = 0; i < CONTROLLER_STRUCTURES[type][controller.level] && i < positions.pos.length; ++i) {
          let pos = new RoomPosition(positions.pos[i].x, positions.pos[i].y, roomName);
          let structure = <Structure<BuildableStructureConstant> | undefined>_.filter(pos.lookFor(LOOK_STRUCTURES),
            (s) => s.structureType == type)[0];
          if (!structure) {
            if (constructions <= 5) {
              let constructionSite = _.filter(pos.lookFor(LOOK_CONSTRUCTION_SITES), (s) => s.structureType == type)[0];
              if (!constructionSite) {
                sum += CONSTRUCTION_COST[type];
                pos.createConstructionSite(type);
              } else
                sum += constructionSite.progressTotal - constructionSite.progress;
              ans.push(pos);
              constructions++;
            }
          } else if (structure.hits < structure.hitsMax) {
            sum += structure.hitsMax - structure.hits;
            ans.push(pos);
          }
        }
    }

    return { pos: ans, sum: sum };
  }
}
