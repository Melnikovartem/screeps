export const SETTINGS_DEFAULT: Memory["settings"] = {
  framerate: 10,
  generatePixel: Game.cpu.limit > 20,
  wallsHealth: 2_000_0000,
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
