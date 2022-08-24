import type { ResTarget } from "../Hive";

export const BASE_MODE_HIVE: HiveCache["do"] = Game.shard.name === "shardSeason" ? {
  powerMining: 0,
  powerRefining: 1,
  depositMining: 0,
  depositRefining: 0,
  war: 1,
  unboost: 0,
  saveCpu: 0,
  upgrade: 2,
  lab: 2,
  buyIn: 0,
  sellOff: 0,
  buildBoost: 1,
} : {
    powerMining: 0,
    powerRefining: 1,
    depositMining: 1,
    depositRefining: 1,
    war: 1,
    unboost: 0,
    saveCpu: 0,
    upgrade: 1,
    lab: 2,
    buyIn: 1,
    sellOff: 1,
    buildBoost: 2,
  };

export interface HiveCache {
  wallsHealth: number,
  cells: { [id: string]: { [id: string]: any } }
  do: {
    powerMining: 0 | 1,
    powerRefining: 0 | 1,
    depositMining: 0 | 1,
    depositRefining: 0 | 1,
    war: 0 | 1,
    unboost: 0 | 1,
    saveCpu: 0 | 1,
    upgrade: 0 | 1 | 2 | 3, // do not, up to lvl 8, 15 after lvl 8, boosted after lvl 8
    lab: 0 | 1 | 2, // do not, if any is needed, just produce
    buyIn: 0 | 1 | 2 | 3, // nothing, minerals, minerals + energy + ops, anything
    sellOff: 0 | 1, // drop / sellOff for balance,
    buildBoost: 0 | 1 | 2, // no boosting / only war / all cases (nukes, walls etc)
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
