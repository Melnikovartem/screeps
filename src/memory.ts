export class Mem {
  static init() {
    /*
    if (!Memory.masters)
      Memory.masters = [];
    */
  }

  static clean() {
    for (const name in Memory.creeps) {
      if (!(name in Game.creeps)) {
        delete Memory.creeps[name];
      }
    }
  }
}
