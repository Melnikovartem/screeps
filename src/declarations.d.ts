import type { _Apiary } from "./Apiary";
import type { CustomConsole } from "./console";

declare global {
  var Apiary: _Apiary;
  var A: CustomConsole;

  interface RoomMemory {
    // for TRAVELER
    avoid?: any;
  }

  interface CreepMemory {
    refMaster: string;
    born: number;

    //for TRAVELER
    _trav?: any;
    _travel?: any;
    //for Profiler
    profiler?: any;
  }

  interface FlagMemory {
    repeat: number;
    hive: string;
  }

  interface Memory {
    cache: {
      intellegence: any;
    },
    masters: { [id: string]: any };

    // some setting that i wan't to be able to change dynamically
    settings: {
      framerate: number,
    }

    // for TRAVELER
    empire?: any;

    // my giant log
    log: {
      reset: number,
      apiary: number,
      spawns: {
        [id: string]: {
          time: number,
          spawnRoom: string,
          fromSpawn: string,
          orderedBy: string,
        }
      },
      hives: {
        [id: string]: {
          [id: number]: {
            annexNames: string[],
            constructionSites: number,
            emergencyRepairs: number,
            normalRepairs: number,
            spawOrders: {
              [id: string]: {
                amount: number,
                priority: number,
              }
            },
          }
        }
      },
      orders: {
        [id: string]: {
          time: number,
          pos: RoomPosition,
          name: string,
          destroyTime: number,
          acted: boolean,
        }
      },
      crashes: {
        [id: string]: {
          time: number,
          context: string,
          message: string,
        }
      },
      enemies: {
        [id: string]: any,
      }
    },
  }
}
