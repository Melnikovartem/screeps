export interface HiveCache {
  cells: { [id: string]: { [id: string]: any } };
  do: {
    powerMining: 0 | 1;
    powerRefining: 0 | 1;
    depositMining: 0 | 1;
    depositRefining: 0 | 1;
    war: 0 | 1;
    unboost: 0 | 1;
    saveCpu: 0 | 1;
    upgrade: 0 | 1 | 2 | 3; // do not boost, boost up to lvl 8, no boosted energy after lvl 8, boosted energy after lvl 8
    lab: 0 | 1 | 2; // do not, if any is needed, (up to some stockpile after if profitable)
    buyIn: 0 | 1 | 2 | 3; // nothing, minerals, minerals + energy + ops, anything
    sellOff: 0 | 1; // drop / sellOff for balance,
    buildBoost: 0 | 1 | 2 | 3; // no boosting / only war / all cases (nukes, walls etc) / even when peaceful
  };
}

export const BASE_MODE_HIVE: HiveCache["do"] =
  Game.shard.name === "shardSeason"
    ? {
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
      }
    : {
        powerMining: 0,
        powerRefining: 1,
        depositMining: 0,
        depositRefining: 1,
        war: 1,
        unboost: 0,
        saveCpu: 0,
        upgrade: 3,
        lab: 2,
        buyIn: 1,
        sellOff: 1,
        buildBoost: 2,
      };

export interface HiveLog {
  annexNames: string[];
  construction: { numStruct: number; sumEnergy: number };
  spawOrders: number;

  energy: {
    storage: number;
    terminal: number;
    spawners: number;
  };
  controller: { level: number; progress: number; progressTotal: number };
  nukes: { [id: string]: { [launchRoomName: string]: number } };
  defenseHealth: { max: number; min: number; avg: number };

  resourceEvents: resourceEventLog;
}
