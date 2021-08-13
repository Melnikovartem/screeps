import { Master } from "./beeMaster/_Master";
import { Bee } from "./bee";
import { _Apiary } from "./Apiary";

// Syntax for adding proprties to `global` (ex "global.log")

declare global {

  namespace NodeJS {
    interface Global {
      masters: { [id: string]: Master };
      bees: { [id: string]: Bee };
      Apiary: _Apiary;
    }
  }

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
  }

  interface Memory {
    log: {
      reset?: number,
      spawns: {
        time: number,
        spawnRoom: string,
        fromSpawn: string,
        spawning: string,
        orderedBy: string,
        priority: number,
      }[],
      hives: {
        [id: string]: {
          annexNames: string[],
          roomTargets: boolean,
          annexesTargets: boolean,
          constructionSites: number,
          emergencyRepairs: number,
          normalRepairs: number,
          orderList: {
            master: string,
            amount: number
          }[],
        }[]
      },
    },
    cache: {
      intellegence: any;
    },
    masters: { [id: string]: any };

    // for TRAVELER
    empire?: any;
  }
}
