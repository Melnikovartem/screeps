import { profile } from "./profiler/decorator";
import { LOGGING_CYCLE } from "./settings";

@profile
export class Mem {
  static init() {
    if (!Memory.masters) Memory.masters = {};
    if (!Memory.log) Memory.log = { spawns: {}, hives: {}, orders: {} };
    if (!Memory.cache) Memory.cache = { intellegence: {} };
  }

  static wipe() {
    console.log("Memory wipe!");
    Memory.masters = {};
    Memory.log = { spawns: {}, hives: {}, orders: {} };
    Memory.cache = { intellegence: {} };
  }

  static clean() {
    for (const name in Memory.creeps)
      if (!(name in Game.creeps)) {
        delete Memory.creeps[name];
        if (global.bees[name]) delete global.bees[name];
      }

    for (const name in Memory.flags)
      if (!(name in Game.flags)) delete Memory.flags[name];

    if (Game.time % LOGGING_CYCLE == 0) {
      if (Object.keys(Memory.log.spawns).length > 25) {
        let j = Object.keys(Memory.log.spawns).length - 10;
        for (let i in Memory.log.spawns) {
          if (Memory.log.spawns[i].time + LOGGING_CYCLE * 3 > Game.time) continue;
          delete Memory.log.spawns[i];
          if (--j == 0) break;
        }
      }

      for (let key in Memory.log.hives)
        if (Object.keys(Memory.log.hives[key]).length > 20) {
          let j = Object.keys(Memory.log.hives[key]).length - 18;
          for (let i in Memory.log.hives[key]) {
            if (<number><unknown>key + LOGGING_CYCLE * 3 > Game.time) continue;
            delete Memory.log.hives[key][i];
            if (--j == 0) break;
          }
        }

      if (Object.keys(Memory.log.orders).length > 25) {
        let j = Object.keys(Memory.log.orders).length - 10;
        for (let i in Memory.log.orders) {
          if (Memory.log.orders[i].time + LOGGING_CYCLE * 3 > Game.time || Memory.log.orders[i].destroyTime == -1) continue;
          delete Memory.log.orders[i];
          if (--j == 0) break;
        }
      }
    }
  }
}
