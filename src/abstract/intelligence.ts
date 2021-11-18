// same as goverment intelligence
// we collect data about enemy
// in this case on battlefield

import { enemyTypes, roomStates } from "../enums";
import { towerCoef } from "./utils";
import { profile } from "../profiler/decorator";

type DangerLvl = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const PEACE_PACKS: string[] = ["Hi_Melnikov", "Digital", "KillerBee"];
export const NON_AGRESSION_PACKS: string[] = [];

export interface Enemy {
  object: Creep | PowerCreep | Structure,
  dangerlvl: DangerLvl,
  type: enemyTypes,
};

interface RoomInfo {
  enemies: Enemy[],
  dangerlvlmax: DangerLvl,
  towers: StructureTower[],

  lastUpdated: number,
  roomState: roomStates,
  currentOwner: string | undefined,
  safePlace: boolean,
  safeModeEndTime: number,
};

export interface CreepBattleInfo {
  dmgClose: number, // in natral hits
  dmgRange: number, // in natral hits
  dism: number, // in natral hits
  heal: number, // in natral hits
  hits: number, // in natral hits
  resist: number, // in natral hits
  move: number, // pertick on plain
};

export interface CreepAllBattleInfo { max: CreepBattleInfo, current: CreepBattleInfo };

@profile
export class Intel {
  roomInfo: { [id: string]: RoomInfo } = {};
  stats: { [id: string]: CreepAllBattleInfo } = {};

  update() {
    this.stats = {};
    if (Game.time % 50 === 0)
      this.toCache();
  }

  getEnemyStructure(pos: ProtoPos, lag?: number) {
    return <Structure | undefined>this.getEnemy(pos, lag, (es, ri, _) => es.filter(e => (![7, 9].includes(ri.dangerlvlmax) || e.dangerlvl === ri.dangerlvlmax) && e.object instanceof Structure));
  }

  getEnemyCreep(pos: ProtoPos, lag?: number) {
    return <Creep | undefined>this.getEnemy(pos, lag, es => es.filter(e => e.object instanceof Creep));
  }

  getEnemy(pos: ProtoPos, lag?: number, filter: (enemies: Enemy[], roomInfo: RoomInfo, pos: RoomPosition) => Enemy[]
    = (es, ri, pos) => es.filter(e => e.dangerlvl === ri.dangerlvlmax || (e.dangerlvl >= 4 && pos.getRangeTo(e.object) <= 5))) {
    if (!(pos instanceof RoomPosition))
      pos = pos.pos;

    let roomInfo = this.getInfo(pos.roomName, lag);
    let enemies = filter(roomInfo.enemies, roomInfo, pos);
    if (!enemies.length)
      return;

    return enemies.reduce((prev, curr) => {
      let ans = (<RoomPosition>pos).getRangeTo(curr.object) - (<RoomPosition>pos).getRangeTo(prev.object);
      if (ans === 0)
        ans = prev.dangerlvl - curr.dangerlvl;
      return ans < 0 ? curr : prev;
    }).object;
  }

  getTowerAttack(pos: RoomPosition, lag?: number) {
    let roomInfo = this.getInfo(pos.roomName, lag);
    let ans = 0;
    _.forEach(roomInfo.towers, t => {
      if (t.isActive() && t.store.getUsedCapacity(RESOURCE_ENERGY) >= 10)
        ans += towerCoef(t, pos) * TOWER_POWER_ATTACK;
    });
    return ans;
  }

  getComplexStats(pos: ProtoPos, range = 1, closePadding = 0, mode: FIND_HOSTILE_CREEPS | FIND_MY_CREEPS = FIND_HOSTILE_CREEPS) {
    if (!(pos instanceof RoomPosition))
      pos = pos.pos;

    let ref = mode + "_" + range + "_" + closePadding + "_" + pos.to_str;
    if (this.stats[ref])
      return this.stats[ref];

    let ans: CreepAllBattleInfo = {
      max: {
        dmgClose: 0,
        dmgRange: 0,
        dism: 0,
        heal: 0,
        hits: 0,
        resist: 0,
        move: 0,
      }, current: {
        dmgClose: 0,
        dmgRange: 0,
        dism: 0,
        heal: 0,
        hits: 0,
        resist: 0,
        move: 0,
      }
    }

    _.forEach(pos.findInRange(mode, range), creep => {
      let stats = this.getStats(creep);
      for (let i in stats.max) {
        let key = <keyof CreepBattleInfo>i;
        let max = stats.max[key];
        let current = stats.current[key];
        switch (key) {
          case "dmgClose":
          case "dism":
            if ((<RoomPosition>pos).getRangeTo(creep) > 1 + closePadding)
              continue;
            break;
          case "resist":
            if ((<RoomPosition>pos).getRangeTo(creep) > 0)
              continue;
            break;
          case "heal":
            if ((<RoomPosition>pos).getRangeTo(creep) > 1 + closePadding)
              current = current * RANGED_HEAL_POWER / HEAL_POWER;
        }
        ans.max[key] += max;
        ans.current[key] += current;
      }
    });
    this.stats[ref] = ans;
    return ans;
  }

  getComplexMyStats(pos: ProtoPos, range = 3, closePadding = 0) {
    return this.getComplexStats(pos, range, closePadding, FIND_MY_CREEPS);
  }

  getInfo(roomName: string, lag: number = 0): RoomInfo {
    let roomInfo = this.roomInfo[roomName];
    if (!roomInfo) {
      let cache = Memory.cache.intellegence[roomName];
      if (cache)
        roomInfo = {
          enemies: [],
          dangerlvlmax: 0,
          towers: [],
          lastUpdated: -1,

          roomState: cache.roomState,
          currentOwner: cache.currentOwner,
          safePlace: cache.safePlace,
          safeModeEndTime: cache.safeModeEndTime,
        };
      else {
        roomInfo = {
          enemies: [],
          dangerlvlmax: 0,
          towers: [],
          lastUpdated: -1,

          roomState: roomStates.noOwner,
          currentOwner: undefined,
          safePlace: true,
          safeModeEndTime: -1,
        };

        let parsed = /^([WE])([0-9]+)([NS])([0-9]+)$/.exec(roomName);
        if (parsed) {
          let [x, y] = [+parsed[2] % 10, +parsed[4] % 10];
          if (x === 0 && y == 0)
            roomInfo.roomState = roomStates.corridor;
          else if (4 <= x && x <= 6 && 4 <= y && y <= 6)
            if (x === 5 && y === 5)
              roomInfo.roomState = roomStates.SKcentral;
            else
              roomInfo.roomState = roomStates.SKfrontier;
        }
      }
      this.roomInfo[roomName] = roomInfo;
    }

    // it is cached after first check
    if (!Apiary.useBucket)
      lag = Math.max(2, lag);
    if (roomInfo.lastUpdated + lag >= Game.time) {
      if (roomInfo.lastUpdated > Game.time && roomName in Game.rooms) {
        roomInfo.enemies = <Enemy[]>_.compact(roomInfo.enemies.map(e => {
          let copy = e.object && <Enemy["object"] | undefined>Game.getObjectById(e.object.id);
          if (!copy || copy.pos.roomName !== roomName)
            return null;
          e.object = copy;
          return e;
        }));
        roomInfo.towers = _.compact(roomInfo.towers.map(t => Game.getObjectById(t.id)!));
      }
      return roomInfo;
    }

    if (!(roomName in Game.rooms)) {
      Apiary.requestSight(roomName);
      roomInfo.enemies = [];
      if (!roomInfo.safePlace && roomInfo.roomState < roomStates.ownedByEnemy && Game.time - roomInfo.lastUpdated > CREEP_LIFE_TIME) {
        roomInfo.safePlace = true;
        roomInfo.dangerlvlmax = 0;
      }
      return roomInfo;
    }

    let room = Game.rooms[roomName];

    roomInfo.currentOwner = undefined;
    if (room.controller) {
      roomInfo.roomState = roomStates.noOwner;
      if (room.controller.safeMode)
        this.roomInfo[room.name].safeModeEndTime = Game.time + room.controller.safeMode;
      let owner = room.controller.owner && room.controller.owner.username;
      if (owner) {
        if (owner === Apiary.username)
          roomInfo.roomState = roomStates.ownedByMe;
        else
          roomInfo.roomState = roomStates.ownedByEnemy;
      } else if (room.controller.reservation) {
        owner = room.controller.reservation.username;
        if (owner === Apiary.username)
          roomInfo.roomState = roomStates.reservedByMe;
        else if (owner === "Invader")
          roomInfo.roomState = roomStates.reservedByInvader;
        else
          roomInfo.roomState = roomStates.reservedByEnemy;
      }
      roomInfo.currentOwner = owner;
    }

    this.updateEnemiesInRoom(room);

    return this.roomInfo[roomName];
  }

  // will *soon* remove in favor for lib
  toCache() {
    for (const roomName in this.roomInfo) {
      let roomInfo = this.roomInfo[roomName];
      if (roomInfo.roomState <= roomStates.reservedByMe || roomInfo.roomState >= roomStates.reservedByEnemy)
        Memory.cache.intellegence[roomName] = {
          roomState: roomInfo.roomState,
          currentOwner: roomInfo.currentOwner,
          safePlace: roomInfo.safePlace,
          safeModeEndTime: roomInfo.safeModeEndTime,
        }
      else
        delete Memory.cache.intellegence[roomName];
    }
  }

  updateEnemiesInRoom(room: Room) {
    let roomInfo = this.roomInfo[room.name];
    roomInfo.lastUpdated = Game.time;
    roomInfo.enemies = [];
    roomInfo.towers = [];

    _.forEach(room.find(FIND_HOSTILE_CREEPS), c => {
      let dangerlvl: DangerLvl = 3;
      let info = this.getStats(c).max;
      if (info.dmgRange >= RANGED_ATTACK_POWER * (MAX_CREEP_SIZE - 20) * 3 || info.dmgClose >= ATTACK_POWER * (MAX_CREEP_SIZE - 20) * 3)
        dangerlvl = 8;
      else if (info.dmgRange > RANGED_ATTACK_POWER * MAX_CREEP_SIZE / 2 || info.dmgClose > ATTACK_POWER * MAX_CREEP_SIZE / 2 || info.heal > HEAL_POWER * MAX_CREEP_SIZE / 2)
        dangerlvl = 6;
      else if (info.heal >= TOWER_POWER_ATTACK * (1 - TOWER_FALLOFF) * 2 || info.dism >= DISMANTLE_POWER * (MAX_CREEP_SIZE - 20))
        dangerlvl = 5;
      else if (info.dmgRange > 0 || info.dmgClose > 0)
        dangerlvl = 4;
      switch (c.owner.username) {
        case "Source Keeper":
          dangerlvl = 2;
          break;
        case "Invader":
          break;
        default:
          if (Apiary.logger)
            Apiary.logger.reportEnemy(c);
          if (PEACE_PACKS.includes(c.owner.username)) {
            if (roomInfo.roomState !== roomStates.ownedByMe) {
              dangerlvl = 0;
              return;
            }
          } else if (NON_AGRESSION_PACKS.includes(c.owner.username) && !Apiary.hives[room.name])
            dangerlvl = 2;
      }
      roomInfo.enemies.push({
        object: c,
        dangerlvl: dangerlvl,
        type: enemyTypes.moving,
      });
    });

    let structures;
    switch (roomInfo.roomState) {
      case roomStates.ownedByEnemy:
        _.forEach(room.find(FIND_HOSTILE_POWER_CREEPS), pc => {
          roomInfo.enemies.push({
            object: pc,
            dangerlvl: 7,
            type: enemyTypes.moving,
          });
        });
      case roomStates.reservedByMe:
      // removing old walls and cores (if only cores then set to 5 around controller)
      case roomStates.reservedByEnemy:
        structures = room.find(FIND_STRUCTURES);
        break;
      case roomStates.SKfrontier:
      case roomStates.noOwner:
      case roomStates.reservedByInvader:
        structures = room.find(FIND_HOSTILE_STRUCTURES);
        break;
    }

    if (structures)
      _.forEach(structures, s => {
        let dangerlvl: DangerLvl = 0;
        switch (s.structureType) {
          case STRUCTURE_INVADER_CORE:
            if (roomInfo.roomState === roomStates.SKfrontier || roomInfo.roomState === roomStates.SKcentral)
              dangerlvl = 9;
            else
              dangerlvl = 3;
            break;
          case STRUCTURE_TOWER:
            dangerlvl = 7;
            roomInfo.towers.push(s);
            break;
          case STRUCTURE_EXTENSION:
          case STRUCTURE_SPAWN:
            if (roomInfo.roomState >= roomStates.ownedByEnemy)
              dangerlvl = 2;
            break;
          case STRUCTURE_STORAGE:
          case STRUCTURE_TERMINAL:
            if (roomInfo.roomState >= roomStates.ownedByEnemy)
              dangerlvl = 1;
            break;
          case STRUCTURE_CONTAINER:
          case STRUCTURE_ROAD:
            if (roomInfo.roomState === roomStates.reservedByEnemy
              && room.controller && room.controller.reservation
              && room.controller.reservation.username !== Apiary.username
              && room.controller.reservation.ticksToEnd >= CONTROLLER_RESERVE_MAX * 0.4)
              dangerlvl = 1;
            break;
        }

        if (s.pos.lookFor(LOOK_FLAGS).filter(f => f.color === COLOR_GREY && f.secondaryColor === COLOR_RED).length)
          if (dangerlvl < 7 && (roomInfo.roomState === roomStates.ownedByEnemy || roomInfo.roomState === roomStates.SKfrontier) && s.structureType !== STRUCTURE_ROAD)
            dangerlvl = 9;
          else if (dangerlvl < 3)
            dangerlvl = 3;

        if (dangerlvl > 0 || (roomInfo.roomState === roomStates.ownedByEnemy && s.hits))
          roomInfo.enemies.push({
            object: s,
            dangerlvl: dangerlvl,
            type: enemyTypes.static,
          });
      });

    if (roomInfo.enemies.length)
      roomInfo.dangerlvlmax = roomInfo.enemies.reduce((prev, curr) => prev.dangerlvl < curr.dangerlvl ? curr : prev).dangerlvl;
    else
      roomInfo.dangerlvlmax = 0;

    roomInfo.safePlace = roomInfo.dangerlvlmax < 4;
  }

  getFleeDist(creep: Creep) {
    let info = this.getStats(creep).current;
    if (info.dmgRange > 0)
      return 4;
    else if (info.dmgClose > 0)
      return 2;
    else
      return 0;
  }

  getStats(creep: Creep) {
    if (creep.id in this.stats)
      return this.stats[creep.id];
    let ans: CreepAllBattleInfo = {
      max: {
        dmgClose: 0,
        dmgRange: 0,
        dism: 0,
        heal: 0,
        hits: 0,
        resist: 0,
        move: 0,
      }, current: {
        dmgClose: 0,
        dmgRange: 0,
        dism: 0,
        heal: 0,
        hits: 0,
        resist: 0,
        move: 0,
      }
    }

    if (!creep)
      return ans;

    ans.current.hits = creep.hits;
    ans.max.hits = creep.hitsMax;
    _.forEach(creep.body, b => {
      let stat: number;
      switch (b.type) {
        case RANGED_ATTACK:
          stat = RANGED_ATTACK_POWER * (b.boost ? BOOSTS.ranged_attack[b.boost].rangedAttack : 1);
          ans.max.dmgRange += stat;
          ans.max.dmgClose += stat;
          ans.max.dism += stat;
          if (b.hits)
            ans.current.dmgRange += stat;
          break;
        case ATTACK:
          stat = ATTACK_POWER * (b.boost ? BOOSTS.attack[b.boost].attack : 1);
          ans.max.dmgClose += stat;
          if (b.hits)
            ans.current.dmgClose += stat;
          break;
        case HEAL:
          stat = HEAL_POWER * (b.boost ? BOOSTS.heal[b.boost].heal : 1);
          ans.max.heal += stat;
          if (b.hits)
            ans.current.heal += stat;
          break;
        case WORK:
          let boost = b.boost && BOOSTS.work[b.boost];
          stat = DISMANTLE_POWER * (boost && "dismantle" in boost ? boost.dismantle : 1);
          ans.max.dism += stat;
          if (b.hits)
            ans.current.dism += stat;
          break;
        case TOUGH:
          stat = 100 / (b.boost ? BOOSTS.tough[b.boost].damage : 1) - 100;
          ans.max.resist += stat;
          if (b.hits)
            ans.current.resist += stat;
          break;
        case MOVE:
      }
    });
    let rounding = (x: number) => Math.ceil(x);
    if (creep.my)
      rounding = (x: number) => Math.floor(x);

    ans.current.resist = rounding(ans.current.resist);
    ans.max.resist = rounding(ans.max.resist);

    ans.current.hits += ans.current.resist;
    ans.max.hits += ans.max.resist;

    this.stats[creep.id] = ans;
    return ans;
  }
}
