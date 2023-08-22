import { getRoomCoorinates } from "../../abstract/utils";
import { prefix, roomStates } from "../../enums";
import type { Hive } from "../../Hive";
import { FlagOrder } from "../../order";
import { profile } from "../../profiler/decorator";
import { Cell } from "../_Cell";

@profile
export class ObserveCell extends Cell {
  public obeserver: StructureObserver;
  private roomsToCheck: string[] = [];
  private doPowerCheck = false;
  public master: undefined;

  public constructor(hive: Hive, obeserver: StructureObserver) {
    super(hive, prefix.observerCell);
    this.obeserver = obeserver;

    this.initCache("corridorRooms", []);
    this.initCache("prevRoom", "");

    if (!this.corridorRooms.length) this.updateRoomsToCheck();
  }

  public get corridorRooms(): string[] {
    return this.fromCache("corridorRooms");
  }

  public set prevRoom(value) {
    this.toCache("prevRoom", value);
  }

  public get prevRoom(): string {
    return this.fromCache("prevRoom");
  }

  public set corridorRooms(value) {
    this.toCache("corridorRooms", value);
  }

  public updateRoomsToCheck() {
    this.corridorRooms = [];
    const [x, y, we, ns] = getRoomCoorinates(this.hive.roomName);
    let closest = we + x + ns + y;
    const roundx = we + Math.round(x / 10) * 10 + ns + y;
    const roundy = we + x + ns + Math.round(y / 10) * 10;
    if (
      this.pos.getRoomRangeTo(roundx, "path") <
      this.pos.getRoomRangeTo(roundy, "path")
    )
      closest = roundx;
    else closest = roundy;
    this.dfs(
      closest,
      this.corridorRooms,
      this.hive.pos.getRoomRangeTo(closest, "path")
    );
    this.prevRoom =
      this.corridorRooms[Math.floor(Math.random() * this.corridorRooms.length)];
  }

  public get pos() {
    return this.obeserver.pos;
  }

  private dfs(
    roomName: string,
    checked: string[],
    depth: number = 0,
    maxDepth: number = Memory.settings.miningDist
  ) {
    if (depth > maxDepth) return;
    checked.push(roomName);
    const exits = Game.map.describeExits(roomName);
    for (const num in exits) {
      const exitName = exits[num as ExitKey]!;
      if (checked.indexOf(exitName) !== -1) continue;
      const [x, y] = getRoomCoorinates(exitName);
      if (x % 10 === 0 || y % 10 === 0)
        this.dfs(exitName, checked, depth + 1, maxDepth);
    }
  }

  public update() {
    super.update();
    if (!this.obeserver) {
      this.delete();
      return;
    }
    this.roomsToCheck = [];

    if (this.hive.cells.defense.timeToLand < 75) {
      const exits = Game.map.describeExits(this.hive.roomName);
      const roomNames = Object.values(exits);
      for (const roomName of roomNames) {
        const roomInfoCheck = Apiary.intel.getInfo(roomName, 25);
        if (Game.time - roomInfoCheck.lastUpdated > 25) {
          this.roomsToCheck = [roomName];
          break;
        }
      }
    }

    if (!this.roomsToCheck.length) {
      const roomName = Apiary.requestRoomSight.filter(
        (roomNameRequested) =>
          this.pos.getRoomRangeTo(roomNameRequested, "lin") <= OBSERVER_RANGE
      )[0];
      if (roomName) {
        this.roomsToCheck = [roomName];
        const index = Apiary.requestRoomSight.indexOf(roomName);
        if (index !== -1) Apiary.requestRoomSight.splice(index, 1);
      } else if (
        this.hive.shouldDo("powerMining") ||
        this.hive.shouldDo("depositMining")
      )
        this.roomsToCheck = this.corridorRooms;
    }

    const room = Game.rooms[this.prevRoom];
    if (!room) return;

    const roomInfo = Apiary.intel.getInfo(this.prevRoom, Infinity);
    if (roomInfo.roomState === roomStates.corridor) {
      if (this.hive.shouldDo("powerMining")) this.powerCheck(room);
      if (this.hive.shouldDo("depositMining")) this.depositCheck(room);
    } else Apiary.intel.getInfo(this.prevRoom, 50);
  }

  public depositCheck(room: Room) {
    _.forEach(room.find(FIND_DEPOSITS), (deposit) => {
      if (
        deposit.lastCooldown > CREEP_LIFE_TIME / 7.5 ||
        deposit.ticksToDecay <= CREEP_LIFE_TIME
      )
        return;
      this.createOrder(
        deposit.pos,
        prefix.depositMining + deposit.id,
        COLOR_BLUE
      );
    });
  }

  public powerCheck(room: Room) {
    _.forEach(
      room.find(FIND_STRUCTURES, {
        filter: { structureType: STRUCTURE_POWER_BANK },
      }),
      (power: StructurePowerBank) => {
        const open = power.pos.getOpenPositions(true).length;
        const dmgPerSecond = ATTACK_POWER * 20 * open;
        if (
          power.hits / dmgPerSecond >=
          power.ticksToDecay + power.pos.getRoomRangeTo(this.hive, "lin") * 50
        )
          return;
        this.createOrder(
          power.pos,
          prefix.powerMining + power.id,
          COLOR_YELLOW
        );
      }
    );
  }

  public createOrder(
    pos: RoomPosition,
    ref: string,
    secondaryColor: ColorConstant
  ) {
    const flags = pos
      .lookFor(LOOK_FLAGS)
      .filter(
        (f) => f.color === COLOR_ORANGE && f.secondaryColor === secondaryColor
      ).length;
    if (flags) return;
    const name = pos.createFlag(ref, COLOR_ORANGE, secondaryColor);
    if (typeof name === "string") {
      Game.flags[name].memory.hive = this.hive.roomName;
      const order = new FlagOrder(Game.flags[name]);
      order.update();
    }
  }

  public run() {
    let index = 0;
    if (this.prevRoom) index = this.roomsToCheck.indexOf(this.prevRoom) + 1;

    if (index < 0 || index >= this.roomsToCheck.length) index = 0;

    if (this.roomsToCheck.length > 0) {
      this.prevRoom = this.roomsToCheck[index];
      this.obeserver.observeRoom(this.prevRoom);
    }
  }
}
