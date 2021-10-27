import type { HivePositions } from "../Hive";

export interface HiveCache {
  positions: HivePositions,
  wallsHealth: number,
  cells: { [id: string]: { [id: string]: any } }
}

export interface HiveLog {
  loggedStates: {
    [id: number]: {
      annexNames: string[],
      structuresConst: number
      sumCost: number,
      spawOrders: {
        [id: string]: number,
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
