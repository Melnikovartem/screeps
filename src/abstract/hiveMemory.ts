import type { HivePositions } from "../Hive";

export interface HiveCache {
  positions: HivePositions,
  wallsHealth: number,
  powerManager?: string;
  cells: { [id: string]: { [id: string]: any } }
}

export interface HiveLog {
  annexNames: string[],
  structuresConst: number,
  sumCost: number,
  spawOrders: number,

  storageEnergy: number,
  terminalEnergy: number,
  energyAvailable: number,
  energyCapacityAvailable: number,
  controllerProgress: number,
  controllerProgressTotal: number,
  controllerLevel: number,

  energyReport: { [id: string]: { profit: number, revenue?: number } },
  resourceBalance: {
    [key in ResourceConstant]?: {
      [id: string]: {
        amount: number,
        time: number,
      }
    }
  }
}
