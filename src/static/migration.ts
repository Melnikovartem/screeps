import { SETTINGS_DEFAULT } from "constants";

export class MigrateManager {
  public static currVersion = "0.0.5";

  public static migrate005() {
    delete Memory.profiler;
    delete Memory.masters;
    delete Memory.roomsToSign;
    delete Memory.logs;
    Memory.settings = SETTINGS_DEFAULT;
  }
}
