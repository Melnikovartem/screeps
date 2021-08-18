// same as goverment intelligence
// we collect data about enemy
// in this case on battlefield
import { profile } from "./profiler/decorator";
import { UPDATE_EACH_TICK, LOGGING_CYCLE } from "./settings";

interface RoomInfo {
  lastUpdated: number,
  enemies: (Creep | Structure)[];
  safePlace: boolean,
  ownedByEnemy: boolean,
  safeModeEndTime: number,
}

@profile
export class Intel {
  roomInfo: { [id: string]: RoomInfo } = {};

  getInfo(roomName: string, lag?: number): RoomInfo {
    if (!this.roomInfo[roomName])
      this.roomInfo[roomName] = {
        lastUpdated: Memory.cache.intellegence[roomName] ? Memory.cache.intellegence[roomName].lastUpdated : -1,
        enemies: [],
        safePlace: Memory.cache.intellegence[roomName] ? Memory.cache.intellegence[roomName].safePlace : true,
        ownedByEnemy: Memory.cache.intellegence[roomName] ? Memory.cache.intellegence[roomName].ownedByEnemy : false,
        safeModeEndTime: Memory.cache.intellegence[roomName] ? Memory.cache.intellegence[roomName].safeModeEndTime : -1,
      };

    // it is cached after first check
    lag = lag ? lag : 0;
    if (UPDATE_EACH_TICK) lag = 0;
    if (this.roomInfo[roomName].lastUpdated + lag >= Game.time)
      return this.roomInfo[roomName];

    if (!(roomName in Game.rooms)) {
      this.roomInfo[roomName].enemies = [];
      return this.roomInfo[roomName];
    }

    let room = Game.rooms[roomName];

    this.updateEnemiesInRoom(room);

    if (room.controller) {
      if (room.controller.safeMode)
        this.roomInfo[room.name].safeModeEndTime = Game.time + room.controller.safeMode; // room.controller.my ? -1 :
      if (room.controller.my || !room.controller.owner)
        this.roomInfo[room.name].ownedByEnemy = false;
    }

    if (Game.time % 50 == 0)
      this.toCache();

    if (Game.time % LOGGING_CYCLE == 0 && !this.roomInfo[room.name].safePlace)
      Memory.log.enemies[room.name + "_" + Game.time] = this.roomInfo[room.name].enemies;
    return this.roomInfo[roomName];
  }

  // will soon remove in favor for lib
  toCache() {
    for (const roomName in this.roomInfo) {
      Memory.cache.intellegence[roomName] = {
        safePlace: this.roomInfo[roomName].safePlace,
        ownedByEnemy: this.roomInfo[roomName].ownedByEnemy,
        safeModeEndTime: this.roomInfo[roomName].safeModeEndTime,
      }
    }
  }

  updateEnemiesInRoom(room: Room) {
    this.roomInfo[room.name].safePlace = false;
    this.roomInfo[room.name].lastUpdated = Game.time;

    this.roomInfo[room.name].enemies = [];

    let targetFlags = _.filter(room.find(FIND_FLAGS), (flag) => flag.color == COLOR_GREY && flag.secondaryColor == COLOR_RED);
    if (targetFlags.length)
      this.roomInfo[room.name].enemies = _.compact(_.map(targetFlags, (flag) => flag.pos.lookFor(LOOK_STRUCTURES)[0]));

    if (!this.roomInfo[room.name].enemies.length)
      this.roomInfo[room.name].enemies = room.find(FIND_HOSTILE_STRUCTURES, {
        filter: (structure) => structure.structureType == STRUCTURE_TOWER ||
          structure.structureType == STRUCTURE_INVADER_CORE
      });

    if (!this.roomInfo[room.name].enemies.length)
      this.roomInfo[room.name].enemies = _.filter(room.find(FIND_HOSTILE_CREEPS), (creep) => creep.getBodyparts(ATTACK) || creep.getBodyparts(HEAL));

    if (!this.roomInfo[room.name].enemies.length)
      this.roomInfo[room.name].enemies = _.filter(room.find(FIND_HOSTILE_CREEPS), (creep) => creep.hits < creep.hitsMax);

    if (!this.roomInfo[room.name].enemies.length) {
      this.roomInfo[room.name].safePlace = true;

      this.roomInfo[room.name].enemies = room.find(FIND_HOSTILE_STRUCTURES, {
        filter: (structure) => structure.structureType == STRUCTURE_SPAWN ||
          structure.structureType == STRUCTURE_POWER_SPAWN
      });

      // time to pillage
      if (!this.roomInfo[room.name].enemies.length)
        this.roomInfo[room.name].enemies = room.find(FIND_HOSTILE_STRUCTURES, {
          filter: (structure) => structure.structureType == STRUCTURE_RAMPART ||
            structure.structureType == STRUCTURE_EXTENSION
        });

      if (!this.roomInfo[room.name].enemies.length)
        this.roomInfo[room.name].enemies = _.filter(room.find(FIND_HOSTILE_CREEPS));
    }
  }
}
