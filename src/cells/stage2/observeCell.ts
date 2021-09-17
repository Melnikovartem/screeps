import { Cell } from "../_Cell";
import type { Hive } from "../../Hive";

import { STORAGE_BALANCE } from "../stage1/storageCell"

import { profile } from "../../profiler/decorator";

@profile
export class observeCell extends Cell {
  obeserver: StructureObserver;
  roomsToCheck: string[] = [];
  prevRoom: string;
  powerRooms: string[] = [];

  constructor(hive: Hive, obeserver: StructureObserver) {
    super(hive, "ObserveCell_" + hive.room.name);
    this.obeserver = obeserver;

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
    this.roomsToCheck = this.powerRooms;

    if (!(this.prevRoom in Game.rooms))
      return;
    let storage = this.hive.cells && this.hive.cells.storage && this.hive.cells.storage.storage;
    if (!storage || storage.store.getUsedCapacity(RESOURCE_ENERGY) < STORAGE_BALANCE[RESOURCE_ENERGY]! / 2)
      return;

    let power = <StructurePowerBank>Game.rooms[this.prevRoom].find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_POWER_BANK } })[0];
    if (!power)
      return;
    let open = power.pos.getOpenPositions(true).length;
    let dmgPerDupl = (CREEP_LIFE_TIME - (power.pos.getRoomRangeTo(this.hive) - 1) * 50) * (30 * 20);
    let amountNeeded = power.hits / dmgPerDupl;
    if (Math.floor(amountNeeded / open) * CREEP_LIFE_TIME > power.ticksToDecay)
      return;
    let flags = power.pos.lookFor(LOOK_FLAGS).filter((f) => f.color === COLOR_ORANGE && f.secondaryColor === COLOR_YELLOW).length;
    if (!flags)
      power.pos.createFlag("power_" + power.id, COLOR_ORANGE, COLOR_YELLOW);
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
