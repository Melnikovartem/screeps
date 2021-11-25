import { Cell } from "../_Cell";

import { prefix, roomStates } from "../../enums";
import { getRoomCoorinates } from "../../abstract/utils";

import { profile } from "../../profiler/decorator";
import type { Hive } from "../../Hive";
import type { StorageCell } from "../stage1/storageCell";

@profile
export class ObserveCell extends Cell {
  obeserver: StructureObserver;
  roomsToCheck: string[] = [];
  doPowerCheck = false;
  master: undefined;
  sCell: StorageCell;

  constructor(hive: Hive, obeserver: StructureObserver, sCell: StorageCell) {
    super(hive, prefix.observerCell + hive.room.name);
    this.sCell = sCell;
    this.obeserver = obeserver;
    if (!this.corridorRooms || !this.corridorRooms.length) {
      this.toCache("corridorRooms", []);
      this.updateRoomsToCheck();
    }
    if (!this.prevRoom)
      this.toCache("prevRoom", "");
    if (!this.corridorRooms.length)
      this.updateRoomsToCheck();
  }

  get corridorRooms(): string[] {
    return this.fromCache("corridorRooms");
  }

  set prevRoom(value) {
    this.toCache("prevRoom", value);
  }

  get prevRoom(): string {
    return this.fromCache("prevRoom");
  }

  set corridorRooms(value) {
    this.toCache("corridorRooms", value);
  }

  updateRoomsToCheck() {
    let [x, y, we, ns] = getRoomCoorinates(this.hive.roomName);
    if (Math.abs(Math.round(x / 10) - x) <= Math.abs(Math.round(y / 10) - y))
      x = Math.round(x / 10) * 10
    else
      y = Math.round(y / 10) * 10
    let closest = we + x + ns + y;
    this.dfs(closest, this.corridorRooms, this.hive.pos.getRoomRangeTo(closest, true));
    this.prevRoom = this.corridorRooms[Math.floor(Math.random() * this.corridorRooms.length)];
  }

  get pos() {
    return this.obeserver.pos;
  }

  dfs(roomName: string, checked: string[], depth: number = 0, maxDepth: number = 10) {
    if (depth > maxDepth)
      return;
    checked.push(roomName);
    console.log(checked);
    let exits = Game.map.describeExits(roomName);
    for (let num in exits) {
      let exitName = exits[<ExitKey>num]!;
      if (checked.indexOf(exitName) !== -1)
        continue;
      let [x, y] = getRoomCoorinates(exitName);
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
      this.roomsToCheck = this.corridorRooms;

    let room = Game.rooms[this.prevRoom];
    if (!room)
      return;

    if (this.hive.resState[RESOURCE_ENERGY] < 0)
      return;

    let roomInfo = Apiary.intel.getInfo(this.prevRoom, 50);

    if (roomInfo.roomState === roomStates.corridor) {
      this.powerCheck(room);
      this.depositCheck(room);
    }
  }

  depositCheck(room: Room) {
    _.forEach(room.find(FIND_DEPOSITS), deposit => {
      if (deposit.lastCooldown > CREEP_LIFE_TIME || deposit.ticksToDecay < CREEP_LIFE_TIME * 1.5)
        return;
      let flags = deposit.pos.lookFor(LOOK_FLAGS).filter(f => f.color === COLOR_ORANGE && f.secondaryColor === COLOR_BLUE).length;
      if (!flags) {
        let name = deposit.pos.createFlag(prefix.deposit + deposit.id, COLOR_ORANGE, COLOR_BLUE);
        if (typeof name === "string")
          Game.flags[name].memory.hive = this.hive.roomName;
      }
    });
  }

  powerCheck(room: Room) {
    _.forEach(room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_POWER_BANK } }), (power: StructurePowerBank) => {
      let open = power.pos.getOpenPositions(true).length;
      let dmgPerDupl = (CREEP_LIFE_TIME - power.pos.getRoomRangeTo(this.hive) * 50) * (ATTACK_POWER * 25);
      let amountNeeded = power.hits / dmgPerDupl;
      if (Math.floor(amountNeeded / open) * CREEP_LIFE_TIME > power.ticksToDecay)
        return;
      let flags = power.pos.lookFor(LOOK_FLAGS).filter(f => f.color === COLOR_ORANGE && f.secondaryColor === COLOR_YELLOW).length;
      if (!flags) {
        let name = power.pos.createFlag(prefix.power + power.id, COLOR_ORANGE, COLOR_YELLOW);
        if (typeof name === "string")
          Game.flags[name].memory.hive = this.hive.roomName;
      }
    });
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
