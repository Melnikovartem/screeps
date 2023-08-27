import { SETTINGS_DEFAULT } from "./constants";
import { prefix } from "./enums";

export class MigrateManager {
  public static currVersion = "0.0.5";

  public static migrate005() {
    delete Memory.profiler;
    delete Memory.masters;
    delete Memory.roomsToSign;
    delete Memory.logs;
    Memory.settings = SETTINGS_DEFAULT;

    const hivesCache = Memory.cache.hives;
    for (const hiveName of Object.keys(hivesCache)) {
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
          toAdd.powerManager = cellCache.powerManager;

        if (Object.keys(toAdd).length)
          hivesCache[hiveName].cells[cellType] = toAdd;
      }
    }
  }
}
