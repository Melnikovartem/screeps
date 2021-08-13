'use strict'

import { ErrorMapper } from "utils/ErrorMapper";
import { Mem } from "./memory";

import "./Traveler/Traveler"

import "./prototypes/creeps"
import "./prototypes/pos"

import { _Apiary } from "./Apiary";

import { GENERATE_PIXEL, ERROR_WRAPPER, LOGGING_CYCLE, PRINT_INFO, PUBLIC, PROFILER } from "./settings";

console.log("settings are for", PUBLIC ? "public" : "local!!");

import profiler from 'screeps-profiler';

// This gets run on each global reset
function onGlobalReset(): void {
  // check if all memory position were created
  Mem.init();

  if (PRINT_INFO) console.log("Reset? Cool time is", Game.time);
  if (LOGGING_CYCLE) Memory.log.reset = Game.time;
  if (PROFILER) profiler.enable();

  delete global.Apiary;
  global.Apiary = new _Apiary();
}


function main() {
  if (!global.Apiary || Game.time >= global.Apiary.destroyTime) {
    console.log("here?42");
    delete global.Apiary;
    global.Apiary = new _Apiary();
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
let _loop: () => void;

if (PROFILER) {
  _loop = () => profiler.wrap(main);
} else if (ERROR_WRAPPER) {
  _loop = ErrorMapper.wrapLoop(main);
} else {
  _loop = main;
}

export const loop = _loop;

onGlobalReset();
