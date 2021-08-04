import { ErrorMapper } from "utils/ErrorMapper";
import { Mem } from "./memory";
import { Hive } from "./Hive";

// This gets run on each global reset
function onGlobalReset(): void {
  global.hives = [];
  global.hives.push(new Hive("sim", []));

  console.log("reset", Game.time);

  global.masters = [];
}

function main() {

  if (!global.hives) {
    onGlobalReset();
  }

  // Automatically delete memory of missing creeps

  Mem.clean();

  if (Game.cpu.bucket == 10000) {
    // only on official
    Game.cpu.generatePixel();
  }
}

let _loop = main

if (0) {
  _loop = ErrorMapper.wrapLoop(main);
}

if (0) {
  // profiler.enable();
  // _loop = profiler.wrap(_loop);
}

export const loop = _loop;

onGlobalReset();
