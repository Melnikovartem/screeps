import { getEnterances, towerCoef } from "./utils";
import { roomStates, enemyTypes } from "../enums";
import { Traveler } from "../Traveler/TravelerModified";

import { profile } from "../profiler/decorator";

@profile
export class WarcrimesModule {
  constructor() {
  }

  getOpt(obstacles: { pos: RoomPosition, perc: number }[], ): TravelToOptions {
    return {
      maxRooms: 1,
      offRoad: true,
      ignoreCreeps: true,
      ignoreStructures: true,
      roomCallback: (roomName, matrix) => {
        if (!(roomName in Game.rooms))
          return matrix;
        matrix = new PathFinder.CostMatrix();
        let terrain = Game.map.getRoomTerrain(roomName);
        for (let x = 0; x <= 49; ++x)
          for (let y = 0; y <= 49; ++y)
            if (terrain.get(x, y) === TERRAIN_MASK_WALL)
              matrix.set(x, y, 0xff);
        _.forEach(obstacles, o => matrix.set(o.pos.x, o.pos.y, Math.floor(0xa4 * o.perc)));
        return matrix;
      }
    }
  }

  get siedge() {
    return Memory.cache.war.siedgeInfo;
  }

  updateSiedgeRoom(roomName: string) {
    if (!this.siedge[roomName])
      this.siedge[roomName] = {
        matrix: {},
        lastUpdated: -500,
        breakIn: [],
        freeTargets: [],
        towerDmgBreach: 0,
      };

    let siedge = this.siedge[roomName];
    if (siedge.lastUpdated + 500 < Game.time) {
      let room = Game.rooms[roomName];
      if (!room) {
        Apiary.requestSight(roomName);
        return;
      }
      siedge.lastUpdated = Game.time;
      let roomInfo = Apiary.intel.getInfo(roomName);
      if (roomInfo.roomState !== roomStates.ownedByEnemy)
        return;

      let enterances = getEnterances(roomName);
      siedge.matrix = {};
      for (let x = 0; x <= 49; ++x) {
        siedge.matrix[x] = {};
        for (let y = 0; y <= 49; ++y)
          siedge.matrix[x][y] = 0xff;
      }
      _.forEach(enterances, ent => this.dfs(ent, siedge.matrix));

      // find breach points
      let wallsHealthMax = 1;
      let obstacles: Structure[] = [];
      let targets = room.find(FIND_STRUCTURES).filter(s => {
        switch (s.structureType) {
          case STRUCTURE_SPAWN:
          case STRUCTURE_STORAGE:
          case STRUCTURE_STORAGE:
          case STRUCTURE_SPAWN:
          case STRUCTURE_INVADER_CORE:
          case STRUCTURE_TOWER:
            return true;
          case STRUCTURE_WALL:
          case STRUCTURE_RAMPART:
            if (s.hits > wallsHealthMax)
              wallsHealthMax = s.hits;
            obstacles.push(s);
          default:
            return false;
        }
      });

      if (!targets.length)
        return;

      let target = targets.reduce((prev, curr) => {
        let ans = siedge.matrix[curr.pos.x][curr.pos.y] - siedge.matrix[prev.pos.x][prev.pos.y];
        if (ans === 0)
          ans = Apiary.intel.getTowerAttack(curr.pos) - Apiary.intel.getTowerAttack(prev.pos);
        return ans < 0 ? curr : prev;
      });
      siedge.breakIn = [];
      let path = Traveler.findTravelPath(enterances[0], target, this.getOpt(obstacles.map(s => { return { pos: s.pos, perc: s.hits / wallsHealthMax } }))).path;
      siedge.breakIn = obstacles.filter(o => path.filter(p => o.pos.getRangeTo(p) <= 2).length).map(p => { return { x: p.pos.x, y: p.pos.y } });


      let powerCreepCoef = 1;
      _.forEach(roomInfo.enemies, e => {
        if (!(e.object instanceof PowerCreep))
          return;
        for (const power in e.object.powers) {
          if (+power !== PWR_OPERATE_TOWER)
            continue;
          let powerInfo = e.object.powers[<PowerConstant>+power];
          powerCreepCoef = Math.max(powerCreepCoef, 1 + powerInfo.level * 0.1);
        }
      });

      let towerDmg = _.map(siedge.breakIn, p => {
        let coef = 0;
        let pos = new RoomPosition(p.x, p.y, roomName)
        _.forEach(roomInfo.towers, t => coef += towerCoef(t, pos));
        return { pos: pos, dmg: coef * powerCreepCoef * TOWER_POWER_ATTACK };
      });
      siedge.towerDmgBreach = !towerDmg.length ? 0 : towerDmg.reduce((curr, prev) => {
        let ans = siedge.matrix[curr.pos.x][curr.pos.y] - siedge.matrix[prev.pos.x][prev.pos.y];
        if (ans === 0)
          ans = prev.dmg - curr.dmg;
        return ans < 0 ? curr : prev;
      }).dmg;

      // find free targets
      siedge.freeTargets = roomInfo.enemies
        .filter(e => e.type === enemyTypes.static && e.object.hitsMax < 25000 && (siedge.matrix[e.object.pos.x][e.object.pos.y] <= 4 || e.object instanceof StructureExtractor)
          && !e.object.pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_RAMPART && s.hits > 10000).length)
        .map(e => { return { x: e.object.pos.x, y: e.object.pos.y } });
    }
  }

  dfs(pos: RoomPosition, matrix: { [id: number]: { [id: number]: number } }, depth: number = 1) {
    if ((depth > 1 && depth < 4) || pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_WALL || (s.structureType === STRUCTURE_RAMPART && !(<StructureRampart>s).my)).length)
      ++depth;
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

  update() {
    for (const roomName in this.siedge)
      this.updateSiedgeRoom(roomName);
  }

  run() {

  }
}
