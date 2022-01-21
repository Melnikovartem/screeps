import type { ResTarget } from "../Hive";

export interface HiveCache {
  wallsHealth: number,
  cells: { [id: string]: { [id: string]: any } }
  do: {
    power: 0 | 1,
    deposit: 0 | 1,
    war: 0 | 1,
    unboost: 0 | 1,
    saveCpu: 0 | 1,
  }
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

  resState: ResTarget,
  nukes: { [id: string]: { [launchRoomName: string]: number } },

  defenseHealth: number[],

  energyReport: { [id: string]: number },
  resourceBalance: {
    [key in ResourceConstant]?: {
      [id: string]: number,
    }
  }
}
