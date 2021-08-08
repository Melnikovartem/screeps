export class Mem {
  static init() {
    if (!Memory.masters)
      Memory.masters = {};
  }

  static clean() {
    for (const creepName in Memory.creeps) {
      if (!(creepName in Game.creeps)) {
        delete Memory.creeps[creepName];
      }
    }
  }
}
