export class Hive {
  // do i need roomName and roomNames? those ARE kinda aliases for room.name
  room: Room;
  annexes: Room[]; // this room and annexes

  constructor(roomName: string, annexNames: string[]) {
    this.room = Game.rooms[roomName];
    this.annexes = _.compact(_.map(annexNames, (annexName) => Game.rooms[annexName]));
    this.parseObjects();
  }

  parseObjects() {
    this.room.find(FIND_CONSTRUCTION_SITES);
  }
}
