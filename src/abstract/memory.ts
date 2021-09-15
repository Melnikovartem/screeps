import { profile } from "../profiler/decorator";
import { Logger } from "../convenience/logger";

@profile
export class Mem {
  static init() {
    if (!Memory.masters) Memory.masters = {};
    if (!Memory.cache) Memory.cache = { intellegence: {}, roomPlanner: {}, avoid: {}, positions: {} };
    if (!Memory.cache.intellegence) Memory.cache.intellegence = {};
    if (!Memory.cache.roomPlanner) Memory.cache.roomPlanner = {};
    if (!Memory.cache.avoid) Memory.cache.avoid = {};
    if (!Memory.cache.positions) Memory.cache.positions = {};
    if (!Memory.settings) Memory.settings = { framerate: 10, forceBucket: 0 };

    Logger.init();
  }

  static wipe() {
    console.log("> > Memory wipe!");
    Memory.masters = {};
    Memory.cache = { intellegence: {}, roomPlanner: {}, avoid: {}, positions: {} };
    Memory.settings = { framerate: 10, forceBucket: 0 };

    Logger.init(true);
  }

  static clean() {
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

    if (Apiary.logger)
      Apiary.logger.clean();
  }
}