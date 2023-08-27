import { buildingCostsHive } from "abstract/hiveMemory";

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

export const WALLS_START = 10_000;
