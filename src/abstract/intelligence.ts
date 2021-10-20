// same as goverment intelligence
// we collect data about enemy
// in this case on battlefield

import { enemyTypes, roomStates } from "../enums";
import { profile } from "../profiler/decorator";
import { UPDATE_EACH_TICK } from "../settings";

type DangerLvl = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

const PEACE_PACKS: string[] = ["Hi_Melnikov"];
const NON_AGRESSION_PACKS: string[] = ["Bulletproof"];

export interface Enemy {
  object: Creep | PowerCreep | Structure,
  dangerlvl: DangerLvl,
  type: enemyTypes,
};

interface RoomInfo {
  enemies: Enemy[],
  dangerlvlmax: DangerLvl,

  lastUpdated: number,
  roomState: roomStates,
  currentOwner: string | undefined,
  safePlace: boolean,
  safeModeEndTime: number,
};

export interface CreepBattleInfo {
  dmgClose: number,
  dmgRange: number,
  dism: number,
  heal: number,
  hits: number,
};

export interface CreepAllBattleInfo { max: CreepBattleInfo, current: CreepBattleInfo };

@profile
export class Intel {
  roomInfo: { [id: string]: RoomInfo } = {};
  getEnemyStructure(pos: ProtoPos, lag?: number) {
    return <Structure | undefined>this.getEnemy(pos, lag, (es, _) => es.filter(e => e.object instanceof Structure));
  }

  getEnemyCreep(pos: ProtoPos, lag?: number) {
    return <Creep | undefined>this.getEnemy(pos, lag, (es, _) => es.filter(e => e.object instanceof Creep));
  }

  getEnemy(pos: ProtoPos, lag?: number, filter: (enemies: Enemy[], roomInfo: RoomInfo) => Enemy[]
    = (es, ri) => es.filter(e => e.dangerlvl === ri.dangerlvlmax)) {
    if (!(pos instanceof RoomPosition))
      pos = pos.pos;

    let roomInfo = this.getInfo(pos.roomName, lag);
    let enemies = filter(roomInfo.enemies, roomInfo);
    if (!enemies.length)
      return;

    return enemies.reduce((prev, curr) => {
      let ans = (<RoomPosition>pos).getRangeTo(curr.object) - (<RoomPosition>pos).getRangeTo(prev.object);
      if (ans === 0)
        ans = prev.dangerlvl - curr.dangerlvl;
      return ans < 0 ? curr : prev;
    }).object;
  }

  getComplexStats(pos: ProtoPos, mode: FIND_HOSTILE_CREEPS | FIND_MY_CREEPS = FIND_HOSTILE_CREEPS) {
    if (!(pos instanceof RoomPosition))
      pos = pos.pos;

    let ans: CreepAllBattleInfo = {
      max: {
        dmgClose: 0,
        dmgRange: 0,
        dism: 0,
        heal: 0,
        hits: 0,
      }, current: {
        dmgClose: 0,
        dmgRange: 0,
        dism: 0,
        heal: 0,
        hits: 0,
      }
    }

    let range = 1;
    if (mode === FIND_HOSTILE_CREEPS) {
      range = 1;
      let enemyCreep = pos.lookFor(LOOK_CREEPS)[0];
      if (enemyCreep && enemyCreep.owner.username === "Invaider")
        range = 4;
    }

    _.forEach(pos.findInRange(mode, range), creep => {
      let stats = this.getStats(creep);
      for (let i in stats.max) {
        let key = <keyof CreepBattleInfo>i;
        if ((key === "dmgClose" || key === "dism") && (<RoomPosition>pos).getRangeTo(creep) > 1)
          continue;
        ans.max[key] += stats.max[key];
        ans.current[key] += stats.current[key]
      }
    });

    return ans;
  }

  getComplexMyStats(pos: ProtoPos) {
    return this.getComplexStats(pos, FIND_MY_CREEPS);
  }

  getInfo(roomName: string, lag: number = 0): RoomInfo {
    let roomInfo = this.roomInfo[roomName];
    if (!roomInfo) {
      let cache = Memory.cache.intellegence[roomName];
      if (cache)
        roomInfo = {
          enemies: [],
          dangerlvlmax: 0,
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
      lag = Math.max(4, lag);
    if (UPDATE_EACH_TICK) lag = 0;
    if (roomInfo.lastUpdated + lag >= Game.time)
      return roomInfo;

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
        else if (owner === "Invaider")
          roomInfo.roomState = roomStates.reservedByInvaider;
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
      Memory.cache.intellegence[roomName] = {
        roomState: roomInfo.roomState,
        currentOwner: roomInfo.currentOwner,
        safePlace: roomInfo.safePlace,
        safeModeEndTime: roomInfo.safeModeEndTime,
      }

      if (Apiary.logger)
        _.forEach(roomInfo.enemies, e => {
          if (e.dangerlvl > 4 && e.object instanceof Creep)
            Apiary.logger!.reportEnemy(e.object);
        });
    }
  }

  updateEnemiesInRoom(room: Room) {
    let roomInfo = this.roomInfo[room.name];
    roomInfo.lastUpdated = Game.time;
    roomInfo.enemies = [];

    _.forEach(room.find(FIND_HOSTILE_CREEPS), c => {
      let dangerlvl: DangerLvl = 3;
      let info = this.getStats(c).max;
      if (info.dmgRange >= RANGED_ATTACK_POWER * (MAX_CREEP_SIZE - 10) * 2 || info.dmgClose >= ATTACK_POWER * (MAX_CREEP_SIZE - 10) * 2)
        dangerlvl = 8;
      else if (info.heal >= HEAL_POWER * (MAX_CREEP_SIZE - 10) || info.dism >= DISMANTLE_POWER * (MAX_CREEP_SIZE - 10))
        dangerlvl = 6;
      else if (info.dmgRange > RANGED_ATTACK_POWER * MAX_CREEP_SIZE / 2 || info.dmgClose > ATTACK_POWER * MAX_CREEP_SIZE / 2 || info.heal > HEAL_POWER * MAX_CREEP_SIZE / 2)
        dangerlvl = 5;
      else if (info.dmgRange > 0 || info.dmgClose > 0 || info.heal > 0)
        dangerlvl = 4;
      if (c.owner.username === "Source Keeper")
        dangerlvl = 2;
      else if (c.owner.username === "Invaider")
        dangerlvl = 3;
      else if (PEACE_PACKS.includes(c.owner.username))
        dangerlvl = 0;
      else if (NON_AGRESSION_PACKS.includes(c.owner.username) && !Apiary.hives[room.name])
        dangerlvl = 2;
      roomInfo.enemies.push({
        object: c,
        dangerlvl: dangerlvl,
        type: enemyTypes.moving,
      });
    });

    if (roomInfo.roomState >= roomStates.SKfrontier)
      _.forEach(room.find(FIND_HOSTILE_STRUCTURES), s => {
        let dangerlvl: DangerLvl = 0;
        if (s.structureType === STRUCTURE_INVADER_CORE) {
          dangerlvl = 3;
          if (roomInfo.roomState === roomStates.SKfrontier || roomInfo.roomState === roomStates.SKcentral)
            dangerlvl = 9;
        } else if (s.structureType === STRUCTURE_TOWER)
          dangerlvl = 7;
        else if (roomInfo.roomState === roomStates.SKfrontier && s.structureType === STRUCTURE_RAMPART)
          dangerlvl = 3;
        else if (roomInfo.roomState === roomStates.ownedByEnemy)
          if (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN)
            dangerlvl = 2;

        if (s.pos.lookFor(LOOK_FLAGS).filter(f => f.color === COLOR_GREY && f.secondaryColor === COLOR_RED)) {
          if (dangerlvl < 8 && (roomInfo.roomState === roomStates.ownedByEnemy
            || (roomInfo.roomState === roomStates.SKfrontier && s.structureType === STRUCTURE_TOWER)))
            dangerlvl = 9;
          else if (dangerlvl < 3)
            dangerlvl = 3;
        }

        roomInfo.enemies.push({
          object: s,
          dangerlvl: dangerlvl,
          type: enemyTypes.static,
        });
      });

    if (roomInfo.roomState >= roomStates.reservedByEnemy)
      _.forEach(room.find(FIND_STRUCTURES), s => {
        if (s.structureType === STRUCTURE_ROAD || s.structureType === STRUCTURE_CONTAINER)
          roomInfo.enemies.push({
            object: s,
            dangerlvl: 0,
            type: enemyTypes.static,
          });
      });

    if (roomInfo.enemies.length)
      roomInfo.dangerlvlmax = roomInfo.enemies.reduce((prev, curr) => prev.dangerlvl < curr.dangerlvl ? curr : prev).dangerlvl;
    else
      roomInfo.dangerlvlmax = 0;

    roomInfo.safePlace = roomInfo.dangerlvlmax < 4;

    /*
      let targetFlags = _.filter(room.find(FIND_FLAGS), flag => flag.color === COLOR_GREY && flag.secondaryColor === COLOR_RED);
      let flagTargets = _.compact(_.map(targetFlags, flag => flag.pos.lookFor(LOOK_STRUCTURES)[0]));
    */
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
    let ans: CreepAllBattleInfo = {
      max: {
        dmgClose: 0,
        dmgRange: 0,
        dism: 0,
        heal: 0,
        hits: 0,
      }, current: {
        dmgClose: 0,
        dmgRange: 0,
        dism: 0,
        heal: 0,
        hits: 0,
      }
    }

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
          ans.max.hits += stat;
          if (b.hits)
            ans.current.hits += stat;
      }
    });

    ans.current.hits = Math.ceil(ans.current.hits);
    ans.max.hits = Math.ceil(ans.max.hits);

    return ans;
  }
}
