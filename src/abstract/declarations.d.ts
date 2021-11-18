import type { _Apiary } from "../Apiary";
import type { beeStates } from "../enums";
import type { CustomConsole } from "../convenience/console";
import type { RoomSetup } from "./roomPlanner";
import type { CreepAllBattleInfo } from "./intelligence";
import type { HiveLog, HiveCache } from "./hiveMemory";

declare global {
  var Apiary: _Apiary;
  var A: CustomConsole;

  type ProtoPos = RoomPosition | { pos: RoomPosition };
  type Pos = { x: number, y: number };

  interface RoomPosition {
    getRoomCoorinates(): [number, number, string, string];
    getRoomRangeTo(pos: ProtoPos | Room | string, pathfind?: boolean): number;
    getPositionsInRange(range: number): RoomPosition[];
    getOpenPositions(ignoreCreeps?: boolean, range?: number): RoomPosition[];
    isFree(ignoreCreeps?: boolean): boolean;
    getEnteranceToRoom(): RoomPosition | null;
    getPosInDirection(direction: DirectionConstant): RoomPosition;
    getTimeForPath(pos: ProtoPos): number;
    getRangeApprox(obj: ProtoPos, calcType?: "linear"): number;
    equal(pos: ProtoPos): boolean;
    oppositeDirection(pos: RoomPosition): DirectionConstant;
    findClosest<Obj extends ProtoPos>(objects: Obj[], calc?: (p: RoomPosition, obj: ProtoPos) => number): Obj | null;
    findClosestByTravel<Obj extends ProtoPos>(objects: Obj[], opts?: FindPathOpts): Obj | null;
    readonly to_str: string;
  }

  interface CreepMemory {
    refMaster: string;
    born: number;
    state: beeStates;
    target?: string;

    //for TRAVELER
    _trav?: any;
    _travel?: any;
    //for Profiler
    profiler?: any;
  }

  interface FlagMemory {
    hive: string;
    repeat?: number;
    info?: number; // for different tasks

    extraPos?: RoomPosition
    extraInfo?: any;
  }

  interface Memory {
    cache: {
      intellegence: any;
      roomPlanner: { [id: string]: RoomSetup }
      hives: {
        [id: string]: HiveCache
      },
    },
    masters: { [id: string]: any };

    // some setting that i wan't to be able to change dynamically
    settings: {
      framerate: number,
      forceBucket: number,
      minBalance: number,
    }

    // my giant log
    log: {
      reset: number,
      apiary: number,
      hives: {
        [id: string]: HiveLog
      },
      orders?: {
        [id: string]: {
          time: number,
          pos: RoomPosition,
          name: string,
        }
      },
      crashes?: {
        [id: string]: {
          time: number,
          context: string,
          message: string,
          stack: string,
        }
      },
      enemies?: {
        [id: string]: {
          time: number,
          info: CreepAllBattleInfo,
          pos: RoomPosition,
          owner: string,
        },
      }
    },
  }
}
