import { CACHE_EMPTY_DEFAULT, SETTINGS_DEFAULT } from "static/constants";

import { Logger } from "../convenience/logger";
import { profile } from "../profiler/decorator";

@profile
export class Mem {
  public static init() {
    if (!Memory.cache) Memory.cache = CACHE_EMPTY_DEFAULT;
    if (!Memory.settings) Memory.settings = SETTINGS_DEFAULT;

    for (const roomName in Memory.cache.hives) {
      const room = Game.rooms[roomName];
      if (!(room && room.controller && room && room.controller.my))
        delete Memory.flags[roomName];
    }

    // Memory log is not managed here as it can be undefined
  }

  public static wipe() {
    console.log("> > Memory wipe!");
    Memory.cache = CACHE_EMPTY_DEFAULT;
    Memory.settings = SETTINGS_DEFAULT;

    Logger.wipe();
  }

  public static clean() {
    for (const name in Memory.creeps)
      if (!(name in Game.creeps)) {
        delete Memory.creeps[name];
        if (Apiary.bees[name]) delete Apiary.bees[name];
      }

    for (const name in Memory.flags)
      if (!(name in Game.flags)) {
        delete Memory.flags[name];
        if (Apiary.orders[name]) Apiary.orders[name].delete();
      }

    Apiary.logger.clean();
  }
}
