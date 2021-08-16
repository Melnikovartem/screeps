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
    log: {
      reset?: number,
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
            orderList: {
              master: string,
              amount: number,
              priority: number,
            }[],
          }
        }
      },
      orders: {
        [id: string]: {
          time: number,
          color: number,
          secondaryColor: number,
          pos: RoomPosition,
          name: string,
          repeat: number,
          destroyTime: number,
        }
      },
      crashes: {
        [id: string]: {
          time: number,
          context: string,
          message: string,
        }
      }
    },
    cache: {
      intellegence: any;
    },
    masters: { [id: string]: any };

    // for TRAVELER
    empire?: any;
  }
}
