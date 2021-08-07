import { ErrorMapper } from "utils/ErrorMapper";
import { Mem } from "./memory";

import "./prototypes/creeps"
import "./prototypes/pos"

import { Hive } from "./Hive";
import { Bee } from "./bee";
import { Master } from "./beeMaster/_Master";

const GENERATE_PIXEL = false; // turn on on official
const ERROR_WRAPPER = true; // turn off on official

// This gets run on each global reset
function onGlobalReset(): void {
  // check if all memory position were created
  Mem.init();

  global.hives = {};
  global.bees = {};
  global.masters = {};

  _.forEach(Object.keys(Memory.masters), (refMaster) => {
    // recreate all the masters if failed => delete the master
    let master = Master.fromCash(refMaster);
    if (master)
      global.masters[refMaster] = master;
    else
      delete Memory.masters[refMaster];
  });

  let roomName = "sim";
  global.hives[roomName] = new Hive(roomName, []);

  console.log("Reset? Cool time is", Game.time);

}

function main() {

  if (!global.hives) {
    onGlobalReset();
  }

  _.forEach(Game.creeps, (creep) => {
    if (!global.bees[creep.name]) {
      if (global.masters[creep.memory.refMaster]) {
        // not sure if i rly need a global bees hash
        global.bees[creep.name] = new Bee(creep);
        global.masters[creep.memory.refMaster].catchBee(global.bees[creep.name]);
      }
      // idk what to do if i lost a master to the bee. I guess the bee is just FUCKED for now
    }
  });

  // Automatically delete memory of missing creeps
  Mem.clean();

  // update phase
  _.forEach(global.masters, (master) => {
    master.update();
  });
  _.forEach(global.hives, (hive) => {
    hive.update();
  });

  // run phase
  _.forEach(global.hives, (hive) => {
    hive.run();
  });
  _.forEach(global.masters, (master) => {
    master.run();
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

onGlobalReset();
