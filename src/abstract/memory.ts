import { profile } from "../profiler/decorator";
import { Logger } from "../convenience/logger";

@profile
export class Mem {
  static init() {
    if (!Memory.cache)
      Memory.cache = {
        intellegence: {},
        roomPlanner: {},
        hives: {},
        war: { siedgeInfo: {}, squadsInfo: {} },
        roomsToSign: [],
      };
    if (!Memory.settings)
      Memory.settings = {
        framerate: 10,
        forceBucket: 0,
        minBalance: 0,
        generatePixel: Game.cpu.limit > 20,
        wallsHealth: 20000000,
        miningDist: 8,
        reportCPU: false,
      };

    for (const roomName in Memory.cache.hives) {
      const room = Game.rooms[roomName];
      if (!(room && room.controller && room && room.controller.my))
        delete Memory.flags[roomName];
    }
    Logger.init();
  }

  static wipe() {
    console.log("> > Memory wipe!");
    Memory.masters = undefined;
    Memory.cache = {
      intellegence: {},
      roomPlanner: Memory.cache.roomPlanner || {},
      hives: {},
      war: { siedgeInfo: {}, squadsInfo: {} },
      roomsToSign: [],
    };
    Memory.settings = {
      framerate: 10,
      forceBucket: 0,
      minBalance: 0,
      generatePixel: Game.cpu.limit > 20,
      wallsHealth: 20000000,
      miningDist: 8,
      reportCPU: false,
    };

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

    if (Apiary.logger) Apiary.logger.clean();
  }
}
