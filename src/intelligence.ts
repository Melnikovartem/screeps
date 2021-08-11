// same as goverment intelligence
// we collect data about enemy
// in this case on battlefield

import { UPDATE_EACH_TICK } from "./settings"

interface RoomInfo {
  lastUpdated: number,
  targetCreeps: Creep[];
  targetBuildings: (Structure)[]
  safeToDowngrade: boolean,
  ownedByEnemy: boolean,
  safeModeEndTime: number,
}

export class Intel {

  roomInfo: { [id: string]: RoomInfo } = {};

  getInfo(roomName: string): RoomInfo {
    if (!this.roomInfo[roomName]) {
      this.roomInfo[roomName] = {
        lastUpdated: 0,
        targetCreeps: [],
        targetBuildings: [],
        safeToDowngrade: false,
        ownedByEnemy: true,
        safeModeEndTime: 0,
      };
    }

    if (this.roomInfo[roomName].lastUpdated == Game.time)
      return this.roomInfo[roomName];

    if (!(roomName in Game.rooms))
      if (!UPDATE_EACH_TICK)
        return this.roomInfo[roomName];
      else
        return {
          lastUpdated: 0,
          targetCreeps: [],
          targetBuildings: [],
          safeToDowngrade: false,
          ownedByEnemy: true,
          safeModeEndTime: 0,
        };

    let room = Game.rooms[roomName];

    this.updateEnemiesInRoom(room);

    if (room.controller) {
      if (room.controller.safeMode)
        this.roomInfo[room.name].safeModeEndTime = Game.time + room.controller.safeMode;
      if (room.controller.my || !room.controller.owner)
        this.roomInfo[room.name].ownedByEnemy = false;
    }

    return this.roomInfo[roomName];
  }

  updateEnemiesInRoom(room: Room) {
    this.roomInfo[room.name].lastUpdated = Game.time;

    this.roomInfo[room.name].targetBuildings = room.find(FIND_HOSTILE_STRUCTURES, {
      filter: (structure) => structure.structureType == STRUCTURE_TOWER ||
        structure.structureType == STRUCTURE_INVADER_CORE
    });

    this.roomInfo[room.name].targetCreeps = _.filter(room.find(FIND_HOSTILE_CREEPS), (creep) => creep.getBodyparts(HEAL));

    if (!this.roomInfo[room.name].targetCreeps.length)
      this.roomInfo[room.name].targetCreeps = _.filter(room.find(FIND_HOSTILE_CREEPS), (creep) => creep.getBodyparts(ATTACK));

    if (!this.roomInfo[room.name].targetBuildings.length && !this.roomInfo[room.name].targetCreeps.length)
      this.roomInfo[room.name].targetBuildings = room.find(FIND_HOSTILE_STRUCTURES, {
        filter: (structure) => structure.structureType == STRUCTURE_SPAWN ||
          structure.structureType == STRUCTURE_POWER_SPAWN
      });


    if (!this.roomInfo[room.name].targetBuildings.length && !this.roomInfo[room.name].targetCreeps.length) {
      // time to pillage
      this.roomInfo[room.name].targetBuildings = room.find(FIND_HOSTILE_STRUCTURES, {
        filter: (structure) => structure.structureType == STRUCTURE_RAMPART ||
          structure.structureType == STRUCTURE_EXTENSION
      });

      this.roomInfo[room.name].targetCreeps = _.filter(room.find(FIND_HOSTILE_CREEPS));

      this.roomInfo[room.name].safeToDowngrade = true;
    }
  }
}
