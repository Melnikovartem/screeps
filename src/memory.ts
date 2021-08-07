import { Master } from "./beeMaster/_Master"

export class Mem {
  static init() {
    if (!Memory.masters)
      Memory.masters = {};
    else if (Object.keys(Memory.masters).length)
      Master.fromCash(Object.keys(Memory.masters)[0]);
  }

  static clean() {
    for (const name in Memory.creeps) {
      if (!(name in Game.creeps)) {
        delete Memory.creeps[name];
      }
    }
  }
}
