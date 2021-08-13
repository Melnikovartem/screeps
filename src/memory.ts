import { profile } from "./profiler/decorator";

@profile
export class Mem {
  static init() {
    if (!Memory.masters)
      Memory.masters = {};
    if (!Memory.log)
      Memory.log = {
        spawns: [], hives: {}
      };
    if (!Memory.cache)
      Memory.cache = { intellegence: {} };
  }

  static clean() {
    for (const name in Memory.creeps) {
      if (!(name in Game.creeps)) {
        delete Memory.creeps[name];
        if (global.bees[name])
          delete global.bees[name];
      }
    }

    if (Memory.log.spawns.length > 50)
      Memory.log.spawns.splice(0, Memory.log.spawns.length - 10);

    for (let key in Memory.log.hives)
      if (Memory.log.hives[key].length > 50)
        Memory.log.hives[key].splice(0, Memory.log.spawns.length - 10)
  }
}
