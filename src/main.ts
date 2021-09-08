import { Mem } from "./memory";
import { CustomConsole } from "./convenience/console";

import "./Traveler/Traveler";

import "./prototypes/creeps";
import "./prototypes/pos";

import { _Apiary } from "./Apiary";

import { GENERATE_PIXEL, LOGGING_CYCLE, PROFILER } from "./settings";
import profiler from 'screeps-profiler';

// Mem.wipe();

// This gets run on each global reset
function onGlobalReset(): void {
  // check if all memory position were created
  Mem.init();

  console.log("Reset? Cool time is", Game.time);
  if (LOGGING_CYCLE) Memory.log.reset = Game.time;
  if (PROFILER) profiler.enable();

  delete global.Apiary;
  global.Apiary = new _Apiary();
  Apiary.init();

  global.A = new CustomConsole();
}

function main() {
  if (!Apiary || Game.time >= Apiary.destroyTime) {
    delete global.Apiary;
    global.Apiary = new _Apiary();
    Apiary.init();
  }

  // Automatically delete memory
  Mem.clean();

  Apiary.update();
  Apiary.run();

  // now it checks itself!! i am genius
  if (GENERATE_PIXEL && Game.cpu.bucket === 10000 && Game.cpu.generatePixel)
    Game.cpu.generatePixel();
}

// time to wrap things up
let _loop: () => void;

if (PROFILER) {
  _loop = () => profiler.wrap(main);
} else {
  _loop = main;
}

export const loop = _loop;

onGlobalReset();
