export interface HiveCache {
  // #region Properties (2)

  cells: { [id: string]: { [id: string]: any } };
  annex: string[];
  do: {
    powerMining: 0 | 1;
    powerRefining: 0 | 1;
    depositMining: 0 | 1;
    depositRefining: 0 | 1;
    /** spawn creeps for attacks */
    war: 0 | 1;
    /** nothing / unboost / unboost */
    unboost: 0 | 1;
    saveCpu: 0 | 1;
    /** do not boost, boost up to lvl 8, no boosted max energy after lvl 8, boosted max energy after lvl 8 */
    upgrade: 0 | 1 | 2 | 3;
    // do not, if any is needed, (up to some stockpile after if profitable) */
    lab: 0 | 1 | 2;
    /** nothing, minerals, minerals + energy + ops, anything */
    buyIn: 0 | 1 | 2 | 3;
    /** drop / sellOff for balance / sellOff for profit (schemes) */
    sellOff: 0 | 1 | 2;
    /** no boosting / only war / all cases (nukes, walls etc) / even when peaceful */
    buildBoost: 0 | 1 | 2 | 3;
  };

  // #endregion Properties (2)
}

export interface buildingCostsHive {
  // #region Properties (2)

  annex: {
    build: number;
    repair: number;
  };
  hive: {
    build: number;
    repair: number;
  };

  // #endregion Properties (2)
}

export interface HiveLog {
  // #region Properties (8)

  annexNames: string[];
  construction: { numStruct: number; costs: buildingCostsHive };
  controller: { level: number; progress: number; progressTotal: number };
  defenseHealth: { max: number; min: number; avg: number };
  energy: {
    storage: number;
    terminal: number;
    spawners: number;
  };
  nukes: { [id: string]: { [launchRoomName: string]: number } };
  resourceEvents: resourceEventLog;
  spawnQueLen: number;

  // #endregion Properties (8)
}
