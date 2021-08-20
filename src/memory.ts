import { profile } from "./profiler/decorator";
import { LOGGING_CYCLE } from "./settings";

@profile
export class Mem {
  static init() {
    if (!Memory.masters) Memory.masters = {};
    if (!Memory.log.crashes)
      Memory.log.crashes = {};
    if (!Memory.log.orders)
      Memory.log.orders = {};
    if (!Memory.log.spawns)
      Memory.log.spawns = {};
    if (!Memory.log.hives)
      Memory.log.hives = {};
    if (!Memory.log.enemies)
      Memory.log.enemies = {};
    if (!Memory.cache) Memory.cache = { intellegence: {} };
    if (!Memory.settings) Memory.settings = { framerate: 10 };
  }

  static wipe() {
    console.log("> > Memory wipe!");
    Memory.masters = {};
    Memory.log = {
      reset: -1,
      apiary: -1,
      spawns: {}, hives: {}, orders: {}, crashes: {}, enemies: {}
    };
    Memory.cache = { intellegence: {} };
    Memory.settings = { framerate: 10 };
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

    if (Game.time % LOGGING_CYCLE == 0) {
      if (Memory.log.spawns && Object.keys(Memory.log.spawns).length > 25) {
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
            if (+key + LOGGING_CYCLE * 3 > Game.time) continue;
            delete Memory.log.hives[key][i];
            if (--j == 0) break;
          }
        }

      if (Memory.log.orders && Object.keys(Memory.log.orders).length > 25) {
        let j = Object.keys(Memory.log.orders).length - 10;
        for (let i in Memory.log.orders) {
          if (Memory.log.orders[i].time + LOGGING_CYCLE * 3 > Game.time || Memory.log.orders[i].destroyTime == -1) continue;
          delete Memory.log.orders[i];
          if (--j == 0) break;
        }
      }

      if (Memory.log.crashes && Object.keys(Memory.log.crashes).length > 100) {
        let j = Object.keys(Memory.log.crashes).length - 50;
        for (let key in Memory.log.crashes) {
          delete Memory.log.crashes[key];
          if (--j == 0) break;
        }
      }

      if (Memory.log.enemies && Object.keys(Memory.log.enemies).length > 50) {
        let j = Object.keys(Memory.log.enemies).length - 35;
        for (let key in Memory.log.enemies) {
          delete Memory.log.enemies[key];
          if (--j == 0) break;
        }
      }
    }
  }
}
