import { ErrorMapper } from "utils/ErrorMapper";
import { Mem } from "./memory";

import "./Traveler/Traveler"

import "./prototypes/creeps"
import "./prototypes/pos"

import { _Apiary } from "./Apiary";

import { GENERATE_PIXEL, ERROR_WRAPPER, LOGGING_CYCLE, PRINT_INFO } from "./settings";

// This gets run on each global reset
function onGlobalReset(): void {
  // check if all memory position were created
  Mem.init();

  if (LOGGING_CYCLE)
    Memory.log.reset = Game.time;
  if (PRINT_INFO)
    console.log("Reset? Cool time is", Game.time);

  global.bees = {};
  global.masters = {};

  delete global.Apiary;
  global.Apiary = new _Apiary();
}

function main() {
  if (!global.Apiary || Game.time >= global.Apiary.destroyTime) {
    onGlobalReset()
  }

  // Automatically delete memory
  Mem.clean();

  global.Apiary.update();
  global.Apiary.run();

  // only on official
  if (GENERATE_PIXEL && Game.cpu.bucket == 10000) {
    Game.cpu.generatePixel();
  }
}

// time to wrap things up
let _loop = main;

if (ERROR_WRAPPER) {
  _loop = ErrorMapper.wrapLoop(main);
}

if (0) {
  // profiler.enable();
  // _loop = profiler.wrap(_loop);
}

export const loop = _loop;

onGlobalReset();
