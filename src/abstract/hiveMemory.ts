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
    /** do not boost, boost up to lvl 8, no boosted energy after lvl 8, boosted energy after lvl 8 */
    upgrade: 0 | 1 | 2 | 3;
    // do not, if any is needed, (up to some stockpile after if profitable) */
    lab: 0 | 1 | 2;
    /** nothing, minerals, minerals + energy + ops, anything */
    buyIn: 0 | 1 | 2 | 3;
    /** drop / sellOff for balance, */
    sellOff: 0 | 1;
    /** no boosting / only war / all cases (nukes, walls etc) / even when peaceful */
    buildBoost: 0 | 1 | 2 | 3;
  };
}

export interface buildingCostsHive {
  annex: {
    build: number;
    repair: number;
  };
  hive: {
    build: number;
    repair: number;
  };
}

export interface HiveLog {
  annexNames: string[];
  construction: { numStruct: number; costs: buildingCostsHive };
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
