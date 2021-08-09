export class Mem {
  static init() {
    if (!Memory.masters)
      Memory.masters = {};
    if (!Memory.log) {
      Memory.log = { spawns: [] };
    }
  }

  static clean() {
    for (const name in Memory.creeps) {
      if (!(name in Game.creeps)) {
        delete Memory.creeps[name];
      }
    }

    if (Memory.log.spawns.length > 50) {
      Memory.log.spawns.splice(0, Memory.log.spawns.length - 10);
    }
  }
}
