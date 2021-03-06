import { Mem } from "./abstract/memory";
import { CustomConsole } from "./convenience/console";

import "./Traveler/TravelerModified";

import "./prototypes/creeps";
import "./prototypes/pos";

import { _Apiary } from "./Apiary";

import { LOGGING_CYCLE, PROFILER } from "./settings";
import profiler from 'screeps-profiler';

// if (Game.shard.name === "shard3")
// Mem.wipe();

// This gets run on each global reset
function onGlobalReset(): void {
  // check if all memory position were created
  Mem.init();

  console.log(`Reset ${Game.shard.name}? Cool time is ${Game.time}`);
  if (LOGGING_CYCLE) Memory.log.reset = Game.time;
  if (PROFILER) profiler.enable();

  delete global.Apiary;
  global.Apiary = new _Apiary();
  Apiary.init();

  global.A = new CustomConsole();
}

function main() {
  if (!Memory.settings.generatePixel && Game.cpu.bucket < 250) {
    console.log(`CPU bucket is ${Game.cpu.bucket} @ ${Game.shard.name} aborting`);
    return;
  }

  if (!Apiary || Game.time >= Apiary.destroyTime) {
    delete global.Apiary;
    global.Apiary = new _Apiary();
    Apiary.init();
  }

  // Automatically delete memory
  Mem.clean();

  Apiary.update();
  Apiary.run();

  if (Game.time % 10000 === 0) {
    // for the time beeing. Change from A to another class
    A.sign()
    A.recalcResTime()
  }

  // now it checks itself!! i am genius
  if (Memory.settings.generatePixel && Game.cpu.bucket === 10000 && Game.cpu.generatePixel && Apiary.destroyTime - Game.time >= 20)
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
