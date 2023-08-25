import "Traveler/TravelerModified";
import "prototypes/creeps";
import "prototypes/pos";
import "convenience/console/console-hand-fix";
import "convenience/console/console-debug";

import { Mem } from "abstract/memory";
import { _Apiary } from "Apiary";
import { CustomConsole } from "convenience/console/console";
import profiler from "screeps-profiler";
import { LOGGING_CYCLE, PROFILER } from "settings";

// Migrate memory do not wipe!!

declare global {
  namespace NodeJS {
    interface Global {
      Apiary?: _Apiary;
      A: CustomConsole;
    }
  }
}

// This gets run on each global reset
function onGlobalReset(): void {
  // check if all memory position were created
  Mem.init();

  console.log(`Reset ${Game.shard.name}? Cool time is ${Game.time}`);
  if (LOGGING_CYCLE) Memory.log.tick.reset = Game.time;
  if (PROFILER) profiler.enable();

  delete global.Apiary;
  global.Apiary = new _Apiary();
  global.Apiary.init();

  global.A = new CustomConsole();
}

function main() {
  if (!Memory.settings.generatePixel && Game.cpu.bucket < 300) {
    console.log(
      `CPU bucket is ${Game.cpu.bucket} @ ${Game.shard.name} aborting`
    );
    return;
  }
  let cpu: number | undefined =
    Apiary.logger && Memory.settings.reportCPU ? Game.cpu.getUsed() : undefined;
  if (cpu !== undefined) {
    Apiary.logger!.update();
    Apiary.logger!.reportCPU("rollup", "update", cpu, 1);
    cpu = Game.cpu.getUsed();
  }

  if (global.Apiary === undefined || Game.time >= Apiary.destroyTime) {
    delete global.Apiary;
    global.Apiary = new _Apiary();
    global.Apiary.init();
  }

  if (cpu !== undefined) {
    Apiary.logger!.reportCPU("init", "update", Game.cpu.getUsed() - cpu, 1);
    cpu = Game.cpu.getUsed();
  }

  // Automatically delete memory
  Mem.clean();

  if (cpu !== undefined)
    Apiary.logger!.reportCPU("cleanup", "update", Game.cpu.getUsed() - cpu, 1);

  global.Apiary.update();
  global.Apiary.run();

  if (Game.time % 10000 === 0) {
    // for the time beeing. Change from A to another class
    global.A.sign();
    global.A.recalcResTime();
  }

  // now it checks itself!! i am genius
  if (
    Memory.settings.generatePixel &&
    Game.cpu.bucket === 10000 &&
    Game.cpu.generatePixel &&
    global.Apiary.destroyTime - Game.time >= 20
  )
    Game.cpu.generatePixel();
}

// time to wrap things up
let preLoop: () => void;

if (PROFILER) {
  preLoop = () => profiler.wrap(main);
} else {
  preLoop = main;
}

export const loop = preLoop;

onGlobalReset();
