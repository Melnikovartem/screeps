import { SETTINGS_DEFAULT } from "./constants";

export class MigrateManager {
  public static currVersion = "0.0.5";

  // careful about this
  public static migrate005() {
    // @ts-ignore
    delete Memory.profiler;
    // @ts-ignore
    delete Memory.masters;
    // @ts-ignore
    delete Memory.roomsToSign;
    // @ts-ignore
    delete Memory.logs;
    Memory.settings = SETTINGS_DEFAULT;

    const hivesCache = Memory.cache.hives;
    for (const hiveName of Object.keys(hivesCache)) {
      // @ts-ignore
      delete hivesCache[hiveName].wallsHealth;
      const cellsCache = hivesCache[hiveName].cells;
      hivesCache[hiveName].cells = {};
      for (const [cellType, cellCache] of Object.entries(cellsCache)) {
        const toAdd: { [id: string]: any } = {};
        if ("roadTime" in Object.keys(cellCache))
          toAdd._roadTime = cellCache.roadTime;
        if ("restTime" in Object.keys(cellCache))
          toAdd._restTime = cellCache.restTime;
        if ("poss" in Object.keys(cellCache)) toAdd.poss = cellCache.poss;
        if ("powerManager" in Object.keys(cellCache))
          toAdd._powerManager = cellCache.powerManager;

        if (Object.keys(toAdd).length)
          hivesCache[hiveName].cells[cellType] = toAdd;
      }
    }
  }
}
