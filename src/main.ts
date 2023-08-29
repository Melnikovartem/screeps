// Import necessary modules and scripts
import "Traveler/TravelerModified";
import "prototypes/creeps";
import "prototypes/pos";
// This import stuff is not the way to go
import "convenience/console/console-hand-fix";
import "convenience/console/console-debug";
import "convenience/console/console-market";

// import { MigrateManager } from "static/migration";
// Migrate memory do not wipe!!
// MigrateManager.migrate005();
// Import required classes and constants
import { Mem } from "abstract/memory";
import { _Apiary } from "Apiary";
import { CustomConsole } from "convenience/console/console";
import profiler from "screeps-profiler";
import { LOGGING_CYCLE, PROFILER } from "settings";

// Declare global namespace properties
declare global {
  namespace NodeJS {
    interface Global {
      Apiary?: _Apiary;
      A: CustomConsole;
    }
  }
}

// Function for handling global reset
function onGlobalReset(): void {
  // Initialize memory positions
  Mem.init();

  // Display reset information
  console.log(`Reset ${Game.shard.name}? Cool time is ${Game.time}`);

  // Initialize logging cycle if enabled
  if (LOGGING_CYCLE) Memory.log.tick.reset = Game.time;

  // Enable profiler if enabled
  if (PROFILER) profiler.enable();

  // Initialize Apiary instance
  delete global.Apiary;
  global.Apiary = new _Apiary();
  global.Apiary.init();

  // Initialize custom console
  global.A = new CustomConsole();
}

// Main loop function
function main() {
  // Check if CPU bucket is too low to proceed
  if (!Memory.settings.generatePixel && Game.cpu.bucket < 300) {
    console.log(
      `CPU bucket is ${Game.cpu.bucket} @ ${Game.shard.name} aborting`
    );
    return;
  }

  // Measure CPU usage for logging purposes
  let cpu: number | undefined =
    Apiary.logger && Memory.settings.reportCPU ? Game.cpu.getUsed() : undefined;

  // Update logger and report CPU usage if applicable
  Apiary.logger?.update();
  if (cpu !== undefined) {
    Apiary.logger!.reportCPU("rollup", "update", cpu, 1);
    cpu = Game.cpu.getUsed();
  }

  // Initialize or reset Apiary instance if necessary
  if (global.Apiary === undefined || Game.time >= Apiary.destroyTime) {
    delete global.Apiary;
    global.Apiary = new _Apiary();
    global.Apiary.init();
  }

  // Report CPU usage if applicable
  if (cpu !== undefined) {
    Apiary.logger!.reportCPU("init", "update", Game.cpu.getUsed() - cpu, 1);
    cpu = Game.cpu.getUsed();
  }

  // Clean up memory
  Mem.clean();

  // Report CPU usage if applicable
  if (cpu !== undefined)
    Apiary.logger!.reportCPU("cleanup", "update", Game.cpu.getUsed() - cpu, 1);

  // Update and run Apiary
  global.Apiary.update();
  global.Apiary.run();

  // Periodic actions every 10000 ticks
  if (Game.time % 10000 === 0) {
    // for the time beeing. Change from A to another class
    global.A.sign();
    global.A.removeConst();
    global.A.recalcResTime();
  }

  // Now it checks itself!! i am genius
  if (
    Memory.settings.generatePixel &&
    Game.cpu.bucket === 10000 &&
    Game.cpu.generatePixel &&
    global.Apiary.destroyTime - Game.time >= 20
  )
    Game.cpu.generatePixel();
}

// Define the pre-loop function, accounting for profiler
let preLoop: () => void;

if (PROFILER) {
  preLoop = () => profiler.wrap(main);
} else {
  preLoop = main;
}

// Export the pre-loop function as the main loop function
export const loop = preLoop;

// Perform actions on global reset
onGlobalReset();
