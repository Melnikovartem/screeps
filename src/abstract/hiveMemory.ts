import type { HivePositions } from "../Hive";

export interface HiveCache {
  positions: HivePositions,
}

export interface HiveLog {
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
