import type { RoomPlannerHiveCache } from "antBrain/hivePlanner/planner-active";
import type { SiedgeInfo } from "antBrain/warModule";
import type { _Apiary } from "Apiary";
import type { CustomConsole } from "convenience/console/console";
import type { SwarmOrderInfo } from "orders/swarmOrder";
import type { RoomIntelCacheMap } from "spiderSense/intel-cache";
import type { CreepAllBattleInfo } from "spiderSense/intel-creep";
import type { beeStates } from "static/enums";

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
    /**
     * @param countCreeps do we need to check for creeps. default is **false**
     * @param range range of free positions. default is **1**
     * @returns array of free positions
     */
    getOpenPositions(countCreeps?: boolean, range?: number): RoomPosition[];
    getPosInDirection(direction: DirectionConstant): RoomPosition;
    getPositionsInRange(range: number): RoomPosition[];
    getRangeApprox(obj: ProtoPos, calcType?: "linear"): number;
    getRoomRangeTo(
      pos: ProtoPos | Room | string,
      mode?: "path" | "manh" | "lin"
    ): number;
    getTimeForPath(pos: ProtoPos): number;
    /**
     * checks if pos is free of structures/terrain/creeps (creeps is optional)
     * @param countCreeps do we need to check for creeps. default is **false**
     * @param range range of free positions. default is **1**
     * @returns boolean
     */
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

  interface Memory {
    // #region Properties (5)

    /** important!! operational info, but Apiary could keep on living */
    cache: {
      intel: { [roomName: string]: RoomIntelCacheMap };
      hives: {
        [id: string]: HiveCache;
      };
      orders: { [ref: string]: SwarmOrderInfo };
      war: { siedge: { [ref: string]: SiedgeInfo } };
    };
    // my giant log
    log: LogInfo | undefined;
    /** part of the memory that we don't wipe */
    longterm: {
      roomPlanner: { [hiveName: string]: RoomPlannerHiveCache };
      users: any;
    };
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

    // #endregion Properties (5)
  }
}
