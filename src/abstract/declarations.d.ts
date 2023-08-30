import type { _Apiary } from "Apiary";
import type { CreepSetup } from "bees/creepSetups";
import type { CustomConsole } from "convenience/console/console";
import type { RoomSetup } from "hivePlanner/planner";
import type { CreepAllBattleInfo } from "spiderSense/intelligence";
import type { beeStates, roomStates } from "static/enums";

import type { HiveCache, HiveLog } from "./hiveMemory";

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
    x: number;
    y: number;
  }

  interface RoomPosition {
    getRoomRangeTo(
      pos: ProtoPos | Room | string,
      mode?: "path" | "manh" | "lin"
    ): number;
    getPositionsInRange(range: number): RoomPosition[];
    getOpenPositions(ignoreCreeps?: boolean, range?: number): RoomPosition[];
    isFree(ignoreCreeps?: boolean): boolean;
    getPosInDirection(direction: DirectionConstant): RoomPosition;
    getTimeForPath(pos: ProtoPos): number;
    getRangeApprox(obj: ProtoPos, calcType?: "linear"): number;
    equal(pos: ProtoPos): boolean;
    oppositeDirection(pos: RoomPosition): DirectionConstant;
    findClosest<Obj extends ProtoPos>(
      objects: Obj[],
      calc?: (p: RoomPosition, obj: ProtoPos) => number
    ): Obj | null;
    findClosestByTravel<Obj extends ProtoPos>(
      objects: Obj[],
      opt?: FindPathOpts
    ): Obj | null;
    readonly to_str: string;
    readonly print: string;
    readonly enteranceToRoom: RoomPosition | null;
  }

  interface CreepMemory {
    refMaster: string;
    born: number;
    state: beeStates;
    target?: Id<_HasId>;

    // for TRAVELER
    _trav?: any;
    _travel?: any;
  }

  interface PowerCreepMemory {
    born: number;
    state: beeStates;
    target?: string;

    // for TRAVELER
    _trav?: any;
    _travel?: any;
  }

  interface FlagMemory {
    hive: string;
    info?: number; // for different tasks

    extraPos?: RoomPosition;
    extraInfo?: any;
  }

  interface IntelBattle {
    roomState: roomStates;
    currentOwner: string | undefined;
    safePlace: boolean;
    safeModeEndTime: number;
  }

  interface Memory {
    cache: {
      intellegence: { [roomName: string]: IntelBattle };
      map: {
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
      };
      roomPlanner: { [id: string]: RoomSetup };
      hives: {
        [id: string]: HiveCache;
      };
      war: {
        siedgeInfo: {
          [id: string]: {
            lastUpdated: number;
            breakIn: { x: number; y: number; ent: string; state: number }[];
            freeTargets: { x: number; y: number }[];
            towerDmgBreach: number;
            attackTime: number | null;
            threatLvl: 0 | 1 | 2;
            squadSlots: {
              [id: string]: {
                lastSpawned: number;
                type: "range" | "dism" | "duo";
                breakIn: { x: number; y: number; ent: string; state: number };
              };
            };
          };
        };
        squadsInfo: {
          [id: string]: {
            seidgeStuck: number;
            center: { x: number; y: number; roomName: string };
            target: { x: number; y: number; roomName: string };
            spawned: number;
            rotation: TOP | BOTTOM | LEFT | RIGHT;
            setup: CreepSetup[];
            poss: Pos[];
            possEnt: Pos[];
            hive: string;
            ref: string;
            targetid: Id<_HasId> | "";
            lastUpdatedTarget: number;
            ent: string;
          };
        };
      };
    };

    // some setting that i wan't to be able to change dynamically
    settings: {
      framerate: number;
      generatePixel: boolean;
      /** mining distance for deposit */
      miningDist: number;
      reportCPU: boolean;
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

    // my giant log
    log: LogInfo | undefined;
  }
}

interface LogInfo {
  tick: { current: number; reset: number; create: number };
  gcl: { level: number; progress: number; progressTotal: number };
  gpl: { level: number; progress: number; progressTotal: number };
  cpu: { bucket: number; used: number; limit: number };
  market: { credits: number; resourceEvents: resourceEventLog };
  pixels: number;

  /** logging reported cpu usage by each part of the system. Global per function and normilized by the amount of creeps/structures */
  cpuUsage: {
    update: { [ref: string]: { cpu: number; norm: number } };
    run: { [ref: string]: { cpu: number; norm: number } };
  };

  hives: {
    [id: string]: HiveLog;
  };
}
