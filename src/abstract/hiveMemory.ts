import type { HivePositions, ResTarget } from "../Hive";

export interface HiveCache {
  positions: HivePositions,
  wallsHealth: number,
  cells: { [id: string]: { [id: string]: any } }
  do: {
    power: boolean,
    deposit: boolean,
    war: boolean,
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
