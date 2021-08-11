// same as goverment intelligence
// we collect data about enemy
// in this case on battlefield

interface RoomInfo {
  lastUpdated: number,
  targetCreeps: Creep[];
  targetBuildings: (Structure)[]
  safeToDowngrade: boolean,
}

export class Intel {

  roomInfo: { [id: string]: RoomInfo } = {};

  getInfo(roomName: string): RoomInfo | null {
    if (!this.roomInfo[roomName])
      this.roomInfo[roomName] = {
        lastUpdated: 0,
        targetCreeps: [],
        targetBuildings: [],
        safeToDowngrade: false,
      }

    if (this.roomInfo[roomName].lastUpdated == Game.time)
      return this.roomInfo[roomName];

    let room = Game.rooms[roomName];
    if (!room)
      return null;

    this.updateRoom(room);


    return this.roomInfo[roomName];
  }

  updateRoom(room: Room) {
    this.roomInfo[room.name].lastUpdated = Game.time;

    this.roomInfo[room.name].targetBuildings = room.find(FIND_HOSTILE_STRUCTURES, {
      filter: (structure) => structure.structureType == STRUCTURE_TOWER ||
        structure.structureType == STRUCTURE_INVADER_CORE
    });

    this.roomInfo[room.name].targetCreeps = room.find(FIND_HOSTILE_CREEPS);

    if (!this.roomInfo[room.name].targetBuildings.length)
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

      this.roomInfo[room.name].safeToDowngrade = true;
    }
  }
}
