import { ErrorMapper } from "utils/ErrorMapper";
import { Mem } from "./memory";


function main() {
  console.log(`Current game tick is ${Game.time}`);

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
