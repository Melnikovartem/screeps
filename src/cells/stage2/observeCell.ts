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

    let minx = Math.floor(x / 10) * 10;
    let miny = Math.floor(y / 10) * 10;
    let maxx = Math.ceil(x / 10) * 10;
    let maxy = Math.ceil(y / 10) * 10;

    if (miny == Math.round(y / 10) * 10)
      for (let i = minx; i < maxx; ++i)
        this.powerRooms.push(we + i + ns + miny);
    else
      for (let i = minx; i < maxx; ++i)
        this.powerRooms.push(we + i + ns + maxy);
    if (minx == Math.round(x / 10) * 10)
      for (let j = miny; j < maxy; ++j)
        this.powerRooms.push(we + minx + ns + j);
    else
      for (let j = miny; j < maxy; ++j)
        this.powerRooms.push(we + maxx + ns + j);

    this.prevRoom = this.powerRooms[Math.floor(Math.random() * this.powerRooms.length)];
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
    if (power && power.ticksToDecay > 1500) {
      let open = power.pos.getOpenPositions(true).length;
      let needed = Math.ceil((power.hits / (30 * 20) + (power.pos.getRoomRangeTo(this.hive) - 1) * 50) / power.ticksToDecay + 0.5);
      let flags = power.pos.lookFor(LOOK_FLAGS).filter((f) => f.color === COLOR_RED && f.secondaryColor === COLOR_YELLOW);
      let working = flags.length;
      let nums = [...Array(open).keys()];
      _.forEach(flags, (f) => {
        let regex = /^power_\w*_(\d)/.exec(f.name);
        if (regex) {
          var index = nums.indexOf(+regex[1]);
          if (index !== -1)
            nums.splice(index, 1);
        }
      });
      for (; working < Math.min(needed, open) && nums.length; ++working) {
        let ref = "mining_" + power.id + "_" + nums.pop();
        if (!Game.flags[ref]) {
          power.pos.createFlag(ref, COLOR_RED, COLOR_YELLOW);
        }
      }
    }
  }

  run() {
    let index = 0;
    if (this.prevRoom)
      index = this.roomsToCheck.indexOf(this.prevRoom);

    if (index < 0 || index >= this.roomsToCheck.length)
      index = 0;

    if (this.roomsToCheck.length > 0) {
      this.prevRoom = this.roomsToCheck[index];
      this.obeserver.observeRoom(this.prevRoom);
    }
  }
}
