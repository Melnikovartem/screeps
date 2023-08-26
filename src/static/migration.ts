import { DEFAULT_SETTINGS } from "abstract/declarations";

export class MigrateManager {
  public currVersion = "0.0.5";

  public migrate_0_0_5() {
    delete Memory.profiler;
    delete Memory.masters;
    delete Memory.roomsToSign;
    delete Memory.logs;
    Memory.settings = DEFAULT_SETTINGS;
  }
}
