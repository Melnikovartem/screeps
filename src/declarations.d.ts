import type { _Apiary } from "./Apiary";
import type { beeStates } from "./enums";
import type { CustomConsole } from "./convenience/console";
import type { RoomSetup } from "./abstract/roomPlanner";
import type { HivePositions } from "./Hive";

declare global {
  var Apiary: _Apiary;
  var A: CustomConsole;

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
  }

  interface Memory {
    cache: {
      intellegence: any;
      roomPlanner: { [id: string]: RoomSetup }
      avoid: { [id: string]: number };
      positions: {
        [id: string]: HivePositions,
      }
    },
    masters: { [id: string]: any };

    // some setting that i wan't to be able to change dynamically
    settings: {
      framerate: number,
      forceBucket: number,
    }

    // for TRAVELER
    empire?: any;

    // my giant log
    log: {
      reset: number,
      apiary: number,
      hives: {
        [id: string]: {
          loggedStates: {
            [id: number]: {
              annexNames: string[],
              structuresConst: number
              sumCost: number,
              spawOrders: {
                [id: string]: {
                  amount: number,
                  priority: number,
                }
              }
            }
          },
          spawns: {
            [id: string]: {
              time: number,
              fromSpawn: string,
              orderedBy: string,
              priority: number,
            }
          },
          resourceBalance: {
            [key in ResourceConstant]?: {
              [id: string]: {
                amount: number,
                time: number,
              }
            }
          }
        }
      },
      orders: {
        [id: string]: {
          time: number,
          pos: RoomPosition,
          name: string,
          destroyTime: number,
          master: boolean,
        }
      },
      crashes: {
        [id: string]: {
          time: number,
          context: string,
          message: string,
          stack: string,
        }
      },
      enemies?: {
        [id: string]: { [id: number]: any },
      }
    },
  }
}
