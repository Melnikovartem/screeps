// same as goverment intelligence
// we collect data about enemy
// in this case on battlefield

import { enemyTypes, roomStates } from "../enums";
import { profile } from "../profiler/decorator";
import { UPDATE_EACH_TICK } from "../settings";

type DangerLvl = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

interface Enemy {
  object: Creep | PowerCreep | Structure,
  dangerlvl: DangerLvl,
  type: enemyTypes,
}

interface RoomInfo {
  enemies: Enemy[],
  dangerlvlmax: DangerLvl,

  lastUpdated: number,
  roomState: roomStates,
  currentOwner: string | undefined,
  safePlace: boolean,
  safeModeEndTime: number,
}

@profile
export class Intel {
  roomInfo: { [id: string]: RoomInfo } = {};

  getInfo(roomName: string, lag?: number): RoomInfo {
    let roomInfo = this.roomInfo[roomName];
    if (!roomInfo) {
      let cache = Memory.cache.intellegence[roomName];
      if (cache)
        this.roomInfo[roomName] = {
          enemies: [],
          dangerlvlmax: 0,

          lastUpdated: cache.lastUpdated,
          roomState: cache.roomState,
          currentOwner: cache.currentOwner,
          safePlace: cache.safePlace,
          safeModeEndTime: cache.safeModeEndTime,
        };
      else
        this.roomInfo[roomName] = {
          enemies: [],
          dangerlvlmax: 0,

          lastUpdated: -1,
          roomState: roomStates.noOwner,
          currentOwner: undefined,
          safePlace: true,
          safeModeEndTime: -1,
        };
      roomInfo = this.roomInfo[roomName];
    }
    // it is cached after first check
    lag = lag ? lag : 0;
    if (!Apiary.useBucket)
      lag = Math.max(4, lag);
    if (UPDATE_EACH_TICK) lag = 0;
    if (roomInfo.lastUpdated + lag >= Game.time)
      return roomInfo;

    if (!(roomName in Game.rooms)) {
      roomInfo.enemies = [];
      if (!roomInfo.safePlace && roomInfo.roomState < roomStates.reservedByEnemy && Game.time - roomInfo.lastUpdated > CREEP_LIFE_TIME) {
        roomInfo.safePlace = true;
        roomInfo.dangerlvlmax = 0;
      }
      return roomInfo;
    }

    let room = Game.rooms[roomName];

    this.updateEnemiesInRoom(room);

    if (room.controller) {
      if (room.controller.safeMode)
        this.roomInfo[room.name].safeModeEndTime = Game.time + room.controller.safeMode; // room.controller.my ? -1 :
      let owner = room.controller.owner && room.controller.owner.username
      if (owner) {
        if (owner === Apiary.username)
          roomInfo.roomState = roomStates.ownedByMe;
        else {
          roomInfo.roomState = roomStates.ownedByEnemy;
          Memory.cache.avoid[room.name] = Game.time + 100000;
        }
      } else if (room.controller.reservation) {
        owner = room.controller.reservation.username;
        if (owner === Apiary.username)
          roomInfo.roomState = roomStates.reservedByMe;
        else if (owner === "Invader")
          roomInfo.roomState = roomStates.reservedByInvaider;
        else
          roomInfo.roomState = roomStates.reservedByEnemy;
      }

      roomInfo.currentOwner = owner;
    }

    /*
    if (Game.time % LOGGING_CYCLE === 0 && !this.roomInfo[room.name].safePlace) {
      if (!Memory.log.enemies)
        Memory.log.enemies = {};
      if (!Memory.log.enemies[room.name])
        Memory.log.enemies[room.name] = {};
      if (+_.min(Object.keys(Memory.log.enemies[room.name])) + CREEP_LIFE_TIME / 2 < Game.time)
        Memory.log.enemies[room.name][Game.time] = _.map(this.roomInfo[room.name].enemies,
          (e) => {
            let ans: any = { hits: e.hits, hitsMax: e.hitsMax }
            if (e instanceof Creep) {
              ans.owner = e.owner.username;
              ans.attack = e.getBodyParts(ATTACK);
              ans.heal = e.getBodyParts(HEAL);
            } else
              ans.owner = e.structureType;
            return ans;
          });
    }
    */

    return this.roomInfo[roomName];
  }

  // will *soon* remove in favor for lib
  toCache() {
    for (const roomName in this.roomInfo) {
      let roomInfo = this.roomInfo[roomName];
      Memory.cache.intellegence[roomName] = {
        lastUpdated: roomInfo.lastUpdated,
        roomState: roomInfo.roomState,
        currentOwner: roomInfo.currentOwner,
        safePlace: roomInfo.safePlace,
        safeModeEndTime: roomInfo.safeModeEndTime,
      }
    }
  }

  updateEnemiesInRoom(room: Room) {
    let roomInfo = this.roomInfo[room.name];
    roomInfo.lastUpdated = Game.time;
    roomInfo.enemies = [];

    _.forEach(room.find(FIND_HOSTILE_CREEPS), (c) => {
      let dangerlvl: DangerLvl = 2;
      if (c.getBodyParts(ATTACK) || c.getBodyParts(RANGED_ATTACK)) {
        dangerlvl = 5;
        if (c.getBodyParts(HEAL, 1))
          dangerlvl = 7;
      } else if (c.getBodyParts(HEAL))
        dangerlvl = 4;
      if (c.owner.username === "Source Keeper")
        dangerlvl = 2;
      roomInfo.enemies.push({
        object: c,
        dangerlvl: dangerlvl,
        type: enemyTypes.moving,
      });
    });

    if (roomInfo.roomState >= roomStates.reservedByEnemy || Game.time % 500 === 0)
      _.forEach(room.find(FIND_HOSTILE_STRUCTURES), (s) => {
        let dangerlvl: DangerLvl = 0;
        if (s.structureType === STRUCTURE_INVADER_CORE)
          dangerlvl = 3;
        if (roomInfo.roomState === roomStates.ownedByEnemy)
          if (s.structureType === STRUCTURE_TOWER)
            dangerlvl = 8;
          else if (s.structureType === STRUCTURE_EXTENSION)
            dangerlvl = 1
          else if (s.structureType === STRUCTURE_SPAWN)
            dangerlvl = 2;

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

    /*
      let targetFlags = _.filter(room.find(FIND_FLAGS), (flag) => flag.color === COLOR_GREY && flag.secondaryColor === COLOR_RED);
      let flagTargets = _.compact(_.map(targetFlags, (flag) => flag.pos.lookFor(LOOK_STRUCTURES)[0]));
    */
  }

  getStats(creep: Creep) {
    let ans = {
      dmgClose: 0,
      dmgRange: 0,
      heal: 0,
    }

    _.forEach(creep.body, (b) => {
      if (!b.hits)
        return;
      switch (b.type) {
        case RANGED_ATTACK:
          let dmg = ATTACK_POWER * (b.boost ? BOOSTS.ranged_attack[b.boost] : { rangedAttack: 1 }).rangedAttack;
          ans.dmgRange += dmg;
          ans.dmgClose += dmg;
          break;
        case ATTACK:
          ans.dmgClose += ATTACK_POWER * (b.boost ? BOOSTS.attack[b.boost] : { attack: 1 }).attack;
          break;
        case HEAL:
          ans.heal += HEAL_POWER * (b.boost ? BOOSTS.heal[b.boost] : { heal: 1 }).heal;
          break;
      }
    });

    return ans;
  }
}
