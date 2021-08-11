// same as goverment intelligence
// we collect data about enemy
// in this case on battlefield

interface RoomInfo {
  lastUpdated: number,
  targetCreeps: Creep[];
  defenseBuildings: (StructureTower | StructureInvaderCore)[]
}

export class Intel {

  roomInfo: { [id: string]: RoomInfo } = {};

  getInfo(roomName: string): RoomInfo | null {
    if (!this.roomInfo[roomName])
      this.roomInfo[roomName] = {
        lastUpdated: 0,
        targetCreeps: [],
        defenseBuildings: [],
      }

    if (this.roomInfo[roomName].lastUpdated == Game.time)
      return this.roomInfo[roomName];

    let room = Game.rooms[roomName];
    if (!room)
      return null;


    return this.roomInfo[roomName];
  }

  // update all needed rooms
  update(): void {

  }
}
