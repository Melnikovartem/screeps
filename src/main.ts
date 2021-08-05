import { ErrorMapper } from "utils/ErrorMapper";
import { Mem } from "./memory";
import { Hive } from "./Hive";
import "./prototypes/creeps"
import "./prototypes/pos"

const GENERATE_PIXEL = false; // turn on on official
const ERROR_WRAPPER = true; // turn off on official

// This gets run on each global reset
function onGlobalReset(): void {
  global.hives = [];
  global.hives.push(new Hive("E37S19", []));

  console.log("Reset? Cool time is", Game.time);

  global.masters = [];
}

function main() {

  if (!global.hives) {
    onGlobalReset();
  }

  // Automatically delete memory of missing creeps
  Mem.clean();

  // update phase
  _.forEach(global.hives, (hive) => {
    hive.update();
  });

  // run phase
  _.forEach(global.hives, (hive) => {
    hive.run();
  });

  if (GENERATE_PIXEL && Game.cpu.bucket == 10000) {
    // only on official
    Game.cpu.generatePixel();
  }
}

let _loop = main;

if (ERROR_WRAPPER) {
  _loop = ErrorMapper.wrapLoop(main);
}

if (0) {
  // profiler.enable();
  // _loop = profiler.wrap(_loop);
}

export const loop = _loop;

// onGlobalReset();
