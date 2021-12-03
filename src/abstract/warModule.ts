import { Traveler } from "../Traveler/TravelerModified";
import { SquadWarCrimesMaster } from "../beeMasters/squads/squadWarcrimes";

import { getEnterances, towerCoef } from "./utils";
import { roomStates, enemyTypes, prefix } from "../enums";
import { makeId } from "./utils";
import { setups } from "../bees/creepsetups";

import { profile } from "../profiler/decorator";
import type { Enemy } from "./intelligence";
import type { FormationPositions } from "../beeMasters/squads/squadWarcrimes";

const HEAL_COEF = 1.5; // HEAL/TOUGH setup for my bees

@profile
export class WarcrimesModule {

  squads: { [id: string]: SquadWarCrimesMaster } = {};

  init() {
    _.forEach(Memory.cache.war.squadsInfo, info => {
      if (!Apiary.hives[info.hive]) {
        if (info.spawned === info.formation.length)
          info.hive = Object.keys(Apiary.hives)[0];
        else
          delete Memory.cache.war.squadsInfo[info.ref];
      }
      this.squads[info.ref] = new SquadWarCrimesMaster(this, info);
    });
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
        _.forEach(obstacles, o => matrix.set(o.pos.x, o.pos.y,
          Math.floor((o.pos.x <= 2 || o.pos.x >= 47 || o.pos.y <= 1 || o.pos.y >= 47 ? 0xba : 0xa4) * o.perc)));
        return matrix;
      }
    }
  }

  get siedge() {
    return Memory.cache.war.siedgeInfo;
  }

  updateRoom(roomName: string) {
    if (!this.siedge[roomName])
      this.siedge[roomName] = {
        matrix: {},
        lastUpdated: -500,
        breakIn: [],
        freeTargets: [],
        towerDmgBreach: 0,
        target: { x: 25, y: 25 },
        attackTime: null,
      };

    let siedge = this.siedge[roomName];
    if (siedge.lastUpdated + 500 < Game.time && (siedge.attackTime === null || siedge.attackTime + CREEP_LIFE_TIME >= Game.time)) {
      let room = Game.rooms[roomName];
      if (!room) {
        Apiary.requestSight(roomName);
        return;
      }
      siedge.lastUpdated = Game.time;
      let roomInfo = Apiary.intel.getInfo(roomName);
      if (roomInfo.roomState !== roomStates.ownedByEnemy
        && !(roomInfo.dangerlvlmax === 9 && (roomInfo.roomState === roomStates.SKfrontier || roomInfo.roomState === roomStates.SKcentral))) {
        delete Memory.cache.war.siedgeInfo[roomName];
        return;
      }

      if (roomInfo.safeModeEndTime > 0)
        siedge.attackTime = roomInfo.safeModeEndTime - 100;
      else if (siedge.attackTime === null)
        siedge.attackTime = Game.time - CREEP_LIFE_TIME;


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
        if (room.controller && room.controller.owner) {
          targets = [room.controller];
          if (!room.controller.pos.lookFor(LOOK_FLAGS).filter(f => f.color === COLOR_RED && f.secondaryColor === COLOR_PURPLE).length)
            room.controller.pos.createFlag(prefix.downgrade + room.name, COLOR_RED, COLOR_PURPLE)
        } else
          return; // not sure when this will be case but ok

      let target = targets.reduce((prev, curr) => {
        let ans = siedge.matrix[curr.pos.x][curr.pos.y] - siedge.matrix[prev.pos.x][prev.pos.y];
        if (ans === 0)
          ans = Apiary.intel.getTowerAttack(curr.pos) - Apiary.intel.getTowerAttack(prev.pos);
        return ans < 0 ? curr : prev;
      });

      siedge.target = { x: target.pos.x, y: target.pos.y };
      siedge.breakIn = [siedge.target];
      _.forEach(enterances, ent => {
        if (!obstacles.length)
          return;
        let path = Traveler.findTravelPath(ent, target, this.getOpt(obstacles.map(s => { return { pos: s.pos, perc: s.hits / wallsHealthMax } }))).path;
        siedge.breakIn = siedge.breakIn.concat(obstacles.filter(o => path.filter(p => o.pos.getRangeTo(p) < 1).length).map(p => { return { x: p.pos.x, y: p.pos.y } }));
        obstacles = obstacles.filter(o => !siedge.breakIn.filter(p => o.pos.x === p.x && o.pos.y === p.y).length);
      });

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

      siedge.towerDmgBreach = !towerDmg.length ? 0 : Math.ceil(towerDmg.reduce((curr, prev) => {
        let ans = siedge.matrix[curr.pos.x][curr.pos.y] - siedge.matrix[prev.pos.x][prev.pos.y];
        if (ans === 0)
          ans = prev.dmg - curr.dmg;
        return ans < 0 ? curr : prev;
      }).dmg - 0.0001);

      // find free targets
      siedge.freeTargets = [];
      if (siedge.matrix[target.pos.x][target.pos.y] > 4)
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

  getEnemy(pos: RoomPosition, dismantle: boolean = false) {
    let enemy: Enemy["object"] | undefined;
    let roomInfo = Apiary.intel.getInfo(pos.roomName, 20);
    let noRamp = (e: { object: { pos: RoomPosition } }) => !e.object.pos.lookFor(LOOK_STRUCTURES).filter(s => s.hits > 10000).length;
    if (roomInfo.roomState === roomStates.ownedByEnemy)
      roomInfo = Apiary.intel.getInfo(pos.roomName, 4);
    if (!dismantle) {
      let siedge = this.siedge[pos.roomName];
      let enemies: Enemy[] = roomInfo.enemies.filter(e => pos.getRangeTo(e.object) <= 4
        && !(e.object instanceof StructureRoad) && noRamp(e)); // havoc enemies
      if (siedge && pos.roomName in Game.rooms) {
        if (roomInfo.safeModeEndTime > 0)
          siedge.attackTime = Math.max(roomInfo.safeModeEndTime - 100, siedge.attackTime || 0);
        for (let i = 0; i < siedge.freeTargets.length; ++i) {
          let freeEnemy = roomInfo.enemies.filter(e => e.object.pos.x === siedge.freeTargets[i].x && e.object.pos.y === siedge.freeTargets[i].y)[0];
          if (freeEnemy)
            enemies.push(freeEnemy)
          else if (roomInfo.lastUpdated === Game.time) {
            siedge.freeTargets.splice(i, 1);
            --i;
          }
        }
        for (let i = 0; i < siedge.breakIn.length; ++i) {
          let breakInEnemy = roomInfo.enemies.filter(e => e.object.pos.x === siedge.breakIn[i].x && e.object.pos.y === siedge.breakIn[i].y)[0];
          if (breakInEnemy)
            enemies.push(breakInEnemy)
          else if (roomInfo.lastUpdated === Game.time) {
            siedge.breakIn.splice(i, 1);
            --i;
          }
        }
      }
      if (!enemies.length)
        enemies = roomInfo.enemies.filter(e => e.dangerlvl === roomInfo.dangerlvlmax);
      if (enemies.length)
        enemy = enemies.reduce((prev, curr) => {
          let ans = pos.getRangeTo(curr.object) - pos.getRangeTo(prev.object);
          /* if (pos.getRangeTo(curr.object) <= 3 && noRamp(curr))
            ans = -1;
          else if (pos.getRangeTo(prev.object) <= 3 && noRamp(prev))
            ans = 1; */
          if (ans === 0)
            ans = prev.dangerlvl - curr.dangerlvl;
          return ans < 0 ? curr : prev;
        }).object;
    } else
      enemy = Apiary.intel.getEnemyStructure(pos, 10);
    return enemy;
  }

  sendSquad(roomName: string) {
    let siedge = this.siedge[roomName];
    if (!siedge || siedge.lastUpdated + 500 < Game.time)
      return;
    let hives = _.filter(Apiary.hives, h => h.phase === 2 && h.shouldDo("war") && h.resState[RESOURCE_ENERGY] > 0);
    if (!hives.length)
      return;
    let hive = hives.reduce((prev, curr) => {
      let ans = curr.pos.getRoomRangeTo(roomName) - prev.pos.getRoomRangeTo(roomName);
      if (ans === 0)
        ans = prev.resState[RESOURCE_ENERGY] - curr.resState[RESOURCE_ENERGY];
      return ans < 0 ? curr : prev;
    });
    let ref = makeId(8);
    if (ref in this.squads)
      return; // try next tick bro (can do a while cycle)

    let formationBee = setups.knight.copy();
    let dmgAfterTough = siedge.towerDmgBreach * BOOSTS.tough.XGHO2.damage;
    let healNeeded = dmgAfterTough / HEAL_POWER / BOOSTS.heal.XLHO2.heal * HEAL_COEF;

    let healPerBee = Math.ceil(healNeeded / 4);
    let toughPerBee = Math.ceil((dmgAfterTough - healPerBee * HEAL_POWER * BOOSTS.heal.XLHO2.heal) * 2 / 100);

    if (!dmgAfterTough) {
      healPerBee = 5;
      toughPerBee = 5;
    }

    formationBee.fixed = Array(healPerBee).fill(HEAL).concat(Array(toughPerBee).fill(TOUGH));
    formationBee.patternLimit = 50;

    let formation: FormationPositions = [
      [{ x: 0, y: 0 }, formationBee],
      [{ x: 1, y: 0 }, formationBee],
      [{ x: 0, y: 1 }, formationBee],
      [{ x: 1, y: 1 }, formationBee],
    ]
    if (!dmgAfterTough)
      formation = formation.slice(0, 2);

    this.squads[ref] = new SquadWarCrimesMaster(this, {
      ref: ref,
      hive: hive.roomName,
      target: { ...siedge.target, roomName: roomName },
      formation: formation,
    });
    // could use getTimeForPath, but this saves some cpu
    siedge.attackTime = Game.time + CREEP_LIFE_TIME - hive.pos.getRoomRangeTo(roomName, true) * 50;
  }

  update() {
    for (const roomName in this.siedge) {
      this.updateRoom(roomName);
      let attackTime = this.siedge[roomName] && this.siedge[roomName].attackTime;
      if (attackTime !== null && attackTime <= Game.time
        && !_.filter(this.squads, sq => sq.spawned < sq.targetBeeCount && sq.pos.roomName === roomName).length)
        this.sendSquad(roomName);
    }
  }

  run() {

  }
}
