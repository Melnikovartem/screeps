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
      if (Object.keys(Memory.log.spawns).length > 50) {
        let j = Object.keys(Memory.log.spawns).length - 10;
        for (let i in Memory.log.spawns) {
          delete Memory.log.spawns[i];
          if (++j == 0) break;
        }
      }

      for (let key in Memory.log.hives)
        if (Object.keys(Memory.log.hives[key]).length > 18) {
          let j = Object.keys(Memory.log.hives[key]).length - 18;
          for (let i in Memory.log.hives[key]) {
            delete Memory.log.hives[key][i];
            if (++j == 0) break;
          }
        }

      if (Object.keys(Memory.log.orders).length > 3) {
        let j = Object.keys(Memory.log.orders).length - 1;
        for (let i in Memory.log.orders) {
          if (Memory.log.orders[i].destroyTime == -1) break;
          console.log(">", i);
          delete Memory.log.orders[i];
          if (++j == 0) break;
        }
      }
    }
  }
}
