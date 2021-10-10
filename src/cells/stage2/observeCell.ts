import { Cell } from "../_Cell";
import type { Hive } from "../../Hive";

import { prefix, roomStates } from "../../enums";

import { profile } from "../../profiler/decorator";

@profile
export class ObserveCell extends Cell {
  obeserver: StructureObserver;
  roomsToCheck: string[] = [];
  prevRoom: string;
  powerRooms: string[] = [];
  doPowerCheck = false;
  master: undefined;

  constructor(hive: Hive, obeserver: StructureObserver) {
    super(hive, prefix.observerCell + hive.room.name);
    this.obeserver = obeserver;
    this.pos = obeserver.pos;

    let [x, y, we, ns] = this.hive.pos.getRoomCoorinates();
    if (Math.abs(Math.round(x / 10) - x) <= Math.abs(Math.round(y / 10) - y))
      x = Math.round(x / 10) * 10
    else
      y = Math.round(y / 10) * 10
    let closest = we + x + ns + y;

    this.dfs(closest, this.powerRooms, this.hive.pos.getRoomRangeTo(closest, true));
    this.prevRoom = this.powerRooms[Math.floor(Math.random() * this.powerRooms.length)];
  }

  dfs(roomName: string, checked: string[], depth: number = 0, maxDepth: number = 12) {
    if (depth >= maxDepth)
      return;
    checked.push(roomName);
    let exits = Game.map.describeExits(roomName);
    for (let num in exits) {
      let exitName = exits[<ExitKey>num]!;
      if (checked.indexOf(exitName) !== -1)
        continue;
      let [x, y] = new RoomPosition(25, 25, exitName).getRoomCoorinates();
      if (x % 10 === 0 || y % 10 === 0)
        this.dfs(exitName, checked, depth + 1, maxDepth);
    }
  }

  update() {
    super.update();
    let roomName = Apiary.requestRoomSight.filter(roomName => this.pos.getRoomRangeTo(roomName) <= OBSERVER_RANGE)[0];
    if (roomName) {
      this.roomsToCheck = [roomName];
      for (let i = 0; i < Apiary.requestRoomSight.length; ++i)
        if (Apiary.requestRoomSight[i] === roomName) {
          Apiary.requestRoomSight.splice(i, 1);
          break;
        }
    } else
      this.roomsToCheck = this.powerRooms;

    let room = Game.rooms[this.prevRoom];
    if (!room)
      return;

    let sCell = this.hive.cells.storage;
    if (!sCell || sCell.getUsedCapacity(RESOURCE_ENERGY) < this.hive.resTarget[RESOURCE_ENERGY]!)
      return;

    let roomInfo = Apiary.intel.getInfo(this.prevRoom, 25);

    if (roomInfo.roomState === roomStates.corridor)
      this.powerCheck(room);
  }

  powerCheck(room: Room) {
    let power = <StructurePowerBank | undefined>room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_POWER_BANK } })[0];
    if (!power)
      return;
    let open = power.pos.getOpenPositions(true).length;
    let dmgPerDupl = (CREEP_LIFE_TIME - (power.pos.getRoomRangeTo(this.hive) - 1) * 50) * (30 * 20);
    let amountNeeded = power.hits / dmgPerDupl;
    if (Math.floor(amountNeeded / open) * CREEP_LIFE_TIME > power.ticksToDecay)
      return;
    let flags = power.pos.lookFor(LOOK_FLAGS).filter(f => f.color === COLOR_ORANGE && f.secondaryColor === COLOR_YELLOW).length;
    if (!flags) {
      let name = power.pos.createFlag("power_" + power.id, COLOR_ORANGE, COLOR_YELLOW);
      if (typeof name === "string")
        Game.flags[name].memory.hive = this.hive.roomName;
    }
  }

  run() {
    let index = 0;
    if (this.prevRoom)
      index = this.roomsToCheck.indexOf(this.prevRoom) + 1;

    if (index < 0 || index >= this.roomsToCheck.length)
      index = 0;

    if (this.roomsToCheck.length > 0) {
      this.prevRoom = this.roomsToCheck[index];
      this.obeserver.observeRoom(this.prevRoom);
    }
  }
}
