import { buildingCostsHive, HiveCache } from "abstract/hiveMemory";

export const SETTINGS_DEFAULT: Memory["settings"] = {
  framerate: 10,
  generatePixel: Game.cpu.limit > 20,
  miningDist: 8,
  reportCPU: false,
};

export const CACHE_EMPTY_DEFAULT: Memory["cache"] = {
  intellegence: {},
  map: { rooms: {}, users: {} },
  roomPlanner: Memory.cache.roomPlanner || {},
  hives: Memory.cache.hives || {},
  war: Memory.cache.war || { siedgeInfo: {}, squadsInfo: {} },
};

export const ZERO_COSTS_BUILDING_HIVE: buildingCostsHive = {
  annex: {
    build: 0,
    repair: 0,
  },
  hive: {
    build: 0,
    repair: 0,
  },
};

export const BASE_MODE_HIVE: HiveCache["do"] = {
  powerMining: 0,
  powerRefining: 1,
  depositMining: 0,
  depositRefining: 1,
  war: 1,
  unboost: 0,
  saveCpu: 0,
  upgrade: 1,
  lab: 2,
  buyIn: 2,
  sellOff: 1,
  buildBoost: 2,
};

export const WALLS_START = 10_000;

export type ApiaryReturnCode = ScreepsReturnCode | -101 | -102;
// all codes still in int8
export const ERR_COOLDOWN = -101;
export const ERR_INVALID_ACTION = -102;
