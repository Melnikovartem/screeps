import type { Hive } from "hive/hive";
import { SWARM_MASTER } from "orders/swarm-nums";
import { profile } from "profiler/decorator";
import { prefix, roomStates } from "static/enums";
import { getRoomCoorinates } from "static/utils";

import { Cell } from "../_Cell";

@profile
export class ObserveCell extends Cell {
  // #region Properties (5)

  private roomsToCheck: string[] = [];

  public _corridorRooms: string[] = this.cache("_corridorRooms") || [];
  public _prevRoom: string = this.cache("_prevRoom") || "";
  public obeserver: StructureObserver;

  // #endregion Properties (5)

  // #region Constructors (1)

  public constructor(hive: Hive, obeserver: StructureObserver) {
    super(hive, prefix.observerCell);
    this.obeserver = obeserver;

    if (!this.corridorRooms.length) this.updateRoomsToCheck();
  }

  // #endregion Constructors (1)

  // #region Public Accessors (6)

  public get corridorRooms(): string[] {
    return this._corridorRooms;
  }

  public set corridorRooms(value) {
    this._corridorRooms = this.cache("_corridorRooms", value);
  }

  public get observerRange() {
    return OBSERVER_RANGE;
  }

  public override get pos() {
    return this.obeserver.pos;
  }

  public get prevRoom() {
    return this._prevRoom;
  }

  public set prevRoom(value) {
    this._prevRoom = this.cache("_prevRoom", value);
  }

  // #endregion Public Accessors (6)

  // #region Public Methods (5)

  public depositCheck(room: Room) {
    _.forEach(room.find(FIND_DEPOSITS), (deposit) => {
      if (
        deposit.lastCooldown > CREEP_LIFE_TIME / 7.5 ||
        deposit.ticksToDecay <= CREEP_LIFE_TIME
      )
        return;
      const ref = prefix.depositMining + deposit.id;
      if (Apiary.orders[ref]) return;
      this.hive.createSwarm(ref, deposit.pos, SWARM_MASTER.depositmining);
    });
  }

  public powerCheck(room: Room) {
    _.forEach(
      room.find(FIND_STRUCTURES, {
        filter: { structureType: STRUCTURE_POWER_BANK },
      }),
      (power: StructurePowerBank) => {
        const open = power.pos.getOpenPositions().length;
        const dmgPerSecond = ATTACK_POWER * 20 * open;
        if (
          power.hits / dmgPerSecond >=
          power.ticksToDecay + power.pos.getRoomRangeTo(this.hive, "lin") * 50
        )
          return;

        const ref = prefix.powerMining + power.id;
        if (Apiary.orders[ref]) return;
        this.hive.createSwarm(ref, power.pos, SWARM_MASTER.powermining);
      }
    );
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

  public override update() {
    this.updateObjects([]);
    if (!this.obeserver) {
      this.delete();
      return;
    }
    this.roomsToCheck = [];

    if (this.hive.cells.defense.timeToLand < 50) {
      const exits = Game.map.describeExits(this.hiveName);
      const roomNames = Object.values(exits);
      for (const roomName of roomNames) {
        if (!Apiary.intel.somewhatFreshInfo(roomName)) {
          this.roomsToCheck = [roomName];
          break;
        }
      }
    }

    if (!this.roomsToCheck.length) {
      const roomName = Apiary.oracle.getRoomToCheck(
        this.pos.roomName,
        this.observerRange
      );
      if (roomName) {
        this.roomsToCheck = [roomName];
        Apiary.oracle.roomChecked(roomName);
      } else if (this.hive.mode.powerMining || this.hive.mode.depositMining)
        this.roomsToCheck = this.corridorRooms;
    }

    const room = Game.rooms[this.prevRoom];
    if (!room) return;

    const roomState = Apiary.intel.getRoomState(this.prevRoom);
    if (roomState === roomStates.corridor) {
      if (this.hive.mode.powerMining) this.powerCheck(room);
      if (this.hive.mode.depositMining) this.depositCheck(room);
    } else Apiary.intel.getInfo(this.prevRoom, 50);
  }

  public updateRoomsToCheck() {
    this.corridorRooms = [];
    const [x, y, we, ns] = getRoomCoorinates(this.hiveName);
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

  // #endregion Public Methods (5)

  // #region Private Methods (1)

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

  // #endregion Private Methods (1)
}
