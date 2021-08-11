// same as goverment intelligence
// we collect data about enemy
// in this case on battlefield

interface RoomInfo {
  lastUpdated: number,
  targetCreeps: Creep[];
  targetBuildings: (Structure)[]
  safePlace: boolean,
  ownedByEnemy: boolean,
  safeModeEndTime: number,
}

export class Intel {

  roomInfo: { [id: string]: RoomInfo } = {};

  constructor() {
    this.roomInfo = <{ [id: string]: RoomInfo }>Memory.cache.intellegence;
  }


  getInfo(roomName: string): RoomInfo {
    if (!this.roomInfo[roomName]) {
      this.roomInfo[roomName] = {
        lastUpdated: 0,
        targetCreeps: [],
        targetBuildings: [],
        safePlace: true,
        ownedByEnemy: true,
        safeModeEndTime: 0,
      };
    }

    // it is cached after first check
    if (this.roomInfo[roomName].lastUpdated == Game.time)
      return this.roomInfo[roomName];

    if (!(roomName in Game.rooms)) {
      this.roomInfo[roomName].targetCreeps = [];
      this.roomInfo[roomName].targetBuildings = [];
      return this.roomInfo[roomName];
    }

    let room = Game.rooms[roomName];

    this.updateEnemiesInRoom(room);

    if (room.controller) {
      if (room.controller.safeMode)
        this.roomInfo[room.name].safeModeEndTime = Game.time + room.controller.safeMode;
      if (room.controller.my || !room.controller.owner)
        this.roomInfo[room.name].ownedByEnemy = false;
    }

    if (Game.time % 50 == 0) // for case of reboot
      Memory.cache.intellegence = this.roomInfo;

    return this.roomInfo[roomName];
  }

  updateEnemiesInRoom(room: Room) {
    this.roomInfo[room.name].safePlace = false;

    this.roomInfo[room.name].lastUpdated = Game.time;

    this.roomInfo[room.name].targetBuildings = room.find(FIND_HOSTILE_STRUCTURES, {
      filter: (structure) => structure.structureType == STRUCTURE_TOWER ||
        structure.structureType == STRUCTURE_INVADER_CORE
    });

    this.roomInfo[room.name].targetCreeps = _.filter(room.find(FIND_HOSTILE_CREEPS), (creep) => creep.getBodyparts(HEAL));

    if (!this.roomInfo[room.name].targetCreeps.length)
      this.roomInfo[room.name].targetCreeps = _.filter(room.find(FIND_HOSTILE_CREEPS), (creep) => creep.getBodyparts(ATTACK));

    if (!this.roomInfo[room.name].targetBuildings.length && !this.roomInfo[room.name].targetCreeps.length) {
      this.roomInfo[room.name].safePlace = true;

      this.roomInfo[room.name].targetBuildings = room.find(FIND_HOSTILE_STRUCTURES, {
        filter: (structure) => structure.structureType == STRUCTURE_SPAWN ||
          structure.structureType == STRUCTURE_POWER_SPAWN
      });

      // time to pillage
      if (!this.roomInfo[room.name].targetBuildings.length)
        this.roomInfo[room.name].targetBuildings = room.find(FIND_HOSTILE_STRUCTURES, {
          filter: (structure) => structure.structureType == STRUCTURE_RAMPART ||
            structure.structureType == STRUCTURE_EXTENSION
        });

      this.roomInfo[room.name].targetCreeps = _.filter(room.find(FIND_HOSTILE_CREEPS));
    }
  }
}
