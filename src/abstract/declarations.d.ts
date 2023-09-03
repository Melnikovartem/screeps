import type { _Apiary } from "Apiary";
import type { CustomConsole } from "convenience/console/console";
import type { RoomSetup } from "hivePlanner/planner";
import type { SwarmOrderInfo } from "orders/swarmOrder";
import type { CreepAllBattleInfo } from "spiderSense/intelligence";
import type { beeStates, roomStates } from "static/enums";

import type { HiveCache, HiveLog } from "./hiveMemory";

interface MemorySettings {
  // #region Properties (8)

  framerate: number;
  generatePixel: boolean;
  lifetimeApiary: number;
  loggingCycle: number;
  /** mining distance for deposit */
  miningDist: number;
  reportCPU: boolean;
  richMovement: boolean;
  safeWrap: boolean;

  // #endregion Properties (8)
}

interface IntelGlobal {
  // #region Properties (2)

  /** structure to keep roomInfo */
  rooms: {
    [oomName: string]: {
      energyRes: number;
      mineral: MineralConstant | undefined;
      enemyInfo?: any;
    };
  };
  users: {
    [username: string]: {
      rooms: string[];
    };
  };

  // #endregion Properties (2)
}

interface IntelBattle {
  // #region Public Indexers (1)

  [roomName: string]: {
    roomState: roomStates;
    currentOwner: string | undefined;
    safePlace: boolean;
    safeModeEndTime: number;
  };

  // #endregion Public Indexers (1)
}

interface SiedgeInfo {
  // #region Properties (7)

  attackTime: number | null;
  breakIn: { x: number; y: number; ent: string; state: number }[];
  freeTargets: { x: number; y: number }[];
  lastUpdated: number;
  squadSlots: {
    [id: string]: {
      lastSpawned: number;
      type: "range" | "dism" | "duo";
      breakIn: { x: number; y: number; ent: string; state: number };
    };
  };
  threatLvl: 0 | 1 | 2;
  towerDmgBreach: number;

  // #endregion Properties (7)
}

interface LogInfo {
  // #region Properties (8)

  cpu: { bucket: number; used: number; limit: number };
  /** logging reported cpu usage by each part of the system. Global per function and normilized by the amount of creeps/structures */
  cpuUsage: {
    update: { [ref: string]: { cpu: number; norm: number } };
    run: { [ref: string]: { cpu: number; norm: number } };
  };
  gcl: { level: number; progress: number; progressTotal: number };
  gpl: { level: number; progress: number; progressTotal: number };
  hives: {
    [id: string]: HiveLog;
  };
  market: { credits: number; resourceEvents: resourceEventLog };
  pixels: number;
  tick: { current: number; reset: number; create: number };

  // #endregion Properties (8)
}

declare global {
  let Apiary: _Apiary;
  let A: CustomConsole;

  type NonUndefined<T> = T extends undefined ? never : T;

  type ProtoPos = RoomPosition | { pos: RoomPosition };
  type resourceEventLog = {
    [key in ResourceConstant]?: {
      [id: string]: {
        tick: number;
        amount: number;
        comment: string;
      };
    };
  };

  interface Pos {
    // #region Properties (2)

    x: number;
    y: number;

    // #endregion Properties (2)
  }

  interface RoomPosition {
    // #region Properties (3)

    readonly enteranceToRoom: RoomPosition | null;
    readonly print: string;
    readonly to_str: string;

    // #endregion Properties (3)

    // #region Public Methods (11)

    equal(pos: ProtoPos): boolean;
    findClosest<Obj extends ProtoPos>(
      objects: Obj[],
      calc?: (p: RoomPosition, obj: ProtoPos) => number
    ): Obj | null;
    findClosestByTravel<Obj extends ProtoPos>(
      objects: Obj[],
      opt?: FindPathOpts
    ): Obj | null;
    getOpenPositions(ignoreCreeps?: boolean, range?: number): RoomPosition[];
    getPosInDirection(direction: DirectionConstant): RoomPosition;
    getPositionsInRange(range: number): RoomPosition[];
    getRangeApprox(obj: ProtoPos, calcType?: "linear"): number;
    getRoomRangeTo(
      pos: ProtoPos | Room | string,
      mode?: "path" | "manh" | "lin"
    ): number;
    getTimeForPath(pos: ProtoPos): number;
    isFree(ignoreCreeps?: boolean): boolean;
    oppositeDirection(pos: RoomPosition): DirectionConstant;

    // #endregion Public Methods (11)
  }

  interface CreepMemory {
    // #region Properties (6)

    // for TRAVELER
    _trav?: any;
    _travel?: any;
    born: number;
    refMaster: string;
    state: beeStates;
    target?: Id<_HasId>;

    // #endregion Properties (6)
  }

  interface PowerCreepMemory {
    // #region Properties (5)

    // for TRAVELER
    _trav?: any;
    _travel?: any;
    born: number;
    state: beeStates;
    target?: string;

    // #endregion Properties (5)
  }

  interface FlagMemory {
    // #region Properties (4)

    extraInfo?: any;
    // for different tasks
    extraPos?: RoomPosition;
    hive: string;
    info?: number;

    // #endregion Properties (4)
  }

  interface Memory {
    // #region Properties (4)

    cache: {
      intellegence: IntelBattle;
      map: IntelGlobal;
      roomPlanner: { [id: string]: RoomSetup };
      hives: {
        [id: string]: HiveCache;
      };
      war: {
        siedgeInfo: { [ref: string]: SiedgeInfo };
      };
      orders: { [ref: string]: SwarmOrderInfo };
    };
    // my giant log
    log: LogInfo | undefined;
    report: {
      orders?: {
        [id: string]: {
          time: number;
          pos: RoomPosition;
        };
      };
      crashes?: {
        [id: string]: {
          time: number;
          context: string;
          message: string;
          stack?: string;
        };
      };
      enemies?: {
        [id: string]: CreepAllBattleInfo["max"] & {
          time: number;
          owner: string;
        };
      };
    };
    // some setting that i wan't to be able to change dynamically
    settings: MemorySettings;

    // #endregion Properties (4)
  }
}
