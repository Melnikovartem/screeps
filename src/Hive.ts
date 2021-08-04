import { excavationCell } from "cells/excavationCell"
import { storageCell } from "cells/storageCell"
import { upgradeCell } from "cells/upgradeCell"

export interface hiveCells {
  excavationCell?: excavationCell;
  storageCell?: storageCell;
  upgradeCell?: upgradeCell;
}


export class Hive {
  // do i need roomName and roomNames? those ARE kinda aliases for room.name
  room: Room;
  annexes: Room[]; // this room and annexes
  rooms: Room[]; //this room and annexes
  cells: hiveCells;

  constructor(roomName: string, annexNames: string[]) {
    this.room = Game.rooms[roomName];
    this.annexes = _.compact(_.map(annexNames, (annexName) => Game.rooms[annexName]));
    this.rooms = [this.room].concat(this.annexes);

    this.cells = {};
    this.parseCells();
  }

  parseCells() {
    _.forEach(this.rooms, (room) => {
      room.find(FIND_CONSTRUCTION_SITES);

      _.forEach(room.find(FIND_SOURCES), () => {

      });
    });
  }

  // add to list a new creep
  wish() {

  }
}
