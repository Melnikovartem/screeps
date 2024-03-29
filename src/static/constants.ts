import type { buildingCostsHive, HiveCache } from "abstract/hiveMemory";

const highCpuCap = Game.cpu.limit > 20;
export const SETTINGS_DEFAULT: Memory["settings"] = {
  framerate: highCpuCap ? 1 : 10,
  generatePixel: !!Game.cpu.generatePixel && highCpuCap,
  miningDist: highCpuCap ? 8 : 4,
  reportCPU: false,
  richMovement: true,
  loggingCycle: 100,
  lifetimeApiary: 40000,
  safeWrap: true,
};

export const BASE_MODE_HIVE: HiveCache["do"] = {
  powerMining: 0,
  powerRefining: 1,
  depositMining: 0,
  depositRefining: 1,
  war: 1,
  unboost: 1,
  saveCpu: 0,
  upgrade: 1,
  lab: 2,
  buyIn: 3,
  sellOff: 2,
  buildBoost: 2,
};

export const APPROX_PROFIT_SOURCE = {
  link: 9.2, // 10 - roads - miner - managers - link
  hauling: 8.7, // 10 - roads - miner - managers - haulers
};

export type ApiaryReturnCode = ScreepsReturnCode | -101 | -102 | -200;
// all codes still in int8
export const ERR_COOLDOWN = -101;
export const ERR_INVALID_ACTION = -102;
export const ERR_NO_VISION = -200;

export const ROOM_DIMENTIONS = 50;

export const CACHE_EMPTY_DEFAULT: Memory["cache"] = {
  hives: {},
  orders: {},
  intel: {},
  war: (Memory.cache && Memory.cache.war) || { siedgeInfo: {}, squadsInfo: {} },
};

export const LONGTERM_EMPTY_DEFAULT: Memory["longterm"] = {
  roomPlanner: (Memory.longterm && Memory.longterm.roomPlanner) || {},
  users: {},
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
