import { Cell } from "../_Cell";
import type { Hive } from "../../Hive";

import { STORAGE_BALANCE } from "../stage1/storageCell"

import { makeId } from "../../abstract/utils";
import { profile } from "../../profiler/decorator";

@profile
export class observeCell extends Cell {
  obeserver: StructureObserver;
  roomsToCheck: string[] = [];
  prevRoom: string | undefined;
  powerRooms: string[] = [];

  constructor(hive: Hive, obeserver: StructureObserver) {
    super(hive, "ObserveCell_" + hive.room.name);
    this.obeserver = obeserver;

    let parsed = /^([WE])([0-9]+)([NS])([0-9]+)$/.exec(hive.roomName);
    let x = 0;
    let y = 0;
    if (parsed) {
      x = (+parsed[2]) * (parsed[1] === "W" ? -1 : 1);
      y = (+parsed[4]) * (parsed[3] === "s" ? -1 : 1);

      let minx = Math.floor(x / 10) * 10;
      let miny = Math.floor(y / 10) * 10;
      let maxx = Math.ceil(x / 10) * 10;
      let maxy = Math.ceil(y / 10) * 10;

      for (let i = minx; i < maxx; ++i)
        this.powerRooms.push(parsed[1] + i + parsed[3] + miny);
      for (let i = minx; i < maxx; ++i)
        this.powerRooms.push(parsed[1] + i + parsed[3] + maxy);
      for (let j = miny; j < maxy; ++j)
        this.powerRooms.push(parsed[1] + minx + parsed[3] + j);
      for (let j = miny; j < maxy; ++j)
        this.powerRooms.push(parsed[1] + maxx + parsed[3] + j);
    }
  }

  update() {
    super.update();
    this.roomsToCheck = this.powerRooms;

    if (!this.prevRoom)
      return;
    let storage = this.hive.cells && this.hive.cells.storage && this.hive.cells.storage.storage;
    if (!storage || storage.store.getUsedCapacity(RESOURCE_ENERGY) < STORAGE_BALANCE[RESOURCE_ENERGY]! / 2)
      return;

    let power = <StructurePowerBank>Game.rooms[this.prevRoom].find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_POWER_BANK } })[0];
    if (power) {
      let open = power.pos.getOpenPositions(true).length;
      let needed = Math.ceil(power.hits / (30 * 20) / power.ticksToDecay + 0.5);
      let working = power.pos.lookFor(LOOK_FLAGS).filter((f) => f.color === COLOR_RED && f.secondaryColor === COLOR_YELLOW).length;
      for (; working < Math.min(needed, open); ++working) {
        let ans = power.pos.createFlag("mining_" + power.id + "_" + makeId(4), COLOR_RED, COLOR_ORANGE);
        if (typeof ans === "string")
          Game.flags[ans].memory = { hive: this.hive.roomName };
      }
    }
  }

  run() {
    this.prevRoom = this.roomsToCheck[Math.floor(Math.random() * this.roomsToCheck.length)]
    this.obeserver.observeRoom(this.prevRoom);
  }
}
