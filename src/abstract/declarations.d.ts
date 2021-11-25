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
    findClosestByTravel<Obj extends ProtoPos>(objects: Obj[], opt?: FindPathOpts): Obj | null;
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
  }

  interface PowerCreepMemory {
    born: number;
    state: beeStates;
    target?: string;

    //for TRAVELER
    _trav?: any;
    _travel?: any;
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
    masters: undefined;

    // some setting that i wan't to be able to change dynamically
    settings: {
      framerate: number,
      forceBucket: number,
      minBalance: number,
    }

    // my giant log
    log: {
      time: number,
      reset: number,
      apiary: number,
      gcl: { level: number, progress: number, progressTotal: number },
      gpl: { level: number, progress: number, progressTotal: number },
      cpu: { bucket: number, used: number, limit: number },
      pixels: number,
      credits: number,

      cpuUsage: { update: { [ref: string]: { cpu: number, norm: number } }, run: { [ref: string]: { cpu: number, norm: number } } },

      hives: {
        [id: string]: HiveLog
      },


      orders?: {
        [id: string]: {
          time: number,
          pos: RoomPosition,
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
