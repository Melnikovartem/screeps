import {
  CACHE_EMPTY_DEFAULT,
  LONGTERM_EMPTY_DEFAULT,
  SETTINGS_DEFAULT,
} from "static/constants";

import { Logger } from "../convenience/logger";
import { profile } from "../profiler/decorator";

@profile
export class Mem {
  // #region Public Static Methods (3)

  public static clean() {
    for (const name in Memory.creeps)
      if (!Game.creeps[name]) delete Memory.creeps[name];
    for (const name in Apiary.bees)
      if (!Game.creeps[name]) delete Apiary.bees[name];

    for (const name in Memory.flags)
      if (!Game.creeps[name]) delete Memory.flags[name];
    for (const name in Apiary.flags)
      if (!Game.flags[name]) {
        Apiary.flags[name].delete();
        delete Apiary.flags[name];
      }

    Apiary.logger.clean();
  }

  public static init() {
    if (!Memory.settings) Memory.settings = SETTINGS_DEFAULT;

    if (!Memory.cache) Memory.cache = CACHE_EMPTY_DEFAULT;

    if (!Memory.longterm) Memory.longterm = LONGTERM_EMPTY_DEFAULT;

    for (const roomName in Memory.cache.hives) {
      const room = Game.rooms[roomName];
      if (!room || !room.controller || !room.controller.my)
        delete Memory.cache.hives[roomName];
    }

    if (!Memory.report) Memory.report = {};
    // Memory log is not managed here as it can be undefined
  }

  public static wipe() {
    console.log("> > Memory wipe!");
    Memory.cache = CACHE_EMPTY_DEFAULT;
    Memory.settings = SETTINGS_DEFAULT;

    Logger.wipe();
  }

  // #endregion Public Static Methods (3)
}
