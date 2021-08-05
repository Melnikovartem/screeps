// TRANSFERED
// cause only imports

var armyLoop = require('armies');
var roomLoop = require('rooms');

var creepFuncitons = require('role.functions');
var posFuncitons = require('pos.functions');
var utilityFuncitons = require('utility.functions');

global.ROLES = {
  hauler: require('role.hauler'),
  harvester: require('role.harvester'),
  claimer: require('role.claimer'),
  builder: require('role.builder'),
  upgrader: require('role.upgrader'),
  knight: require('role.knight'),
};

global.OUTPUT_TICK = 200;
global.REUSE_PATH = 5;

/*
  for (let roleName in ROLES) {
    profiler.registerObject(ROLES[roleName], roleName + ".Role");
  }

  const profiler = require('screeps-profiler');


  profiler.wrap(function() {});
*/

module.exports.loop = function() {
  armyLoop();

  for (let creepName in Memory.creeps) {
    let creep = Game.creeps[creepName];

    if (!creep) {
      delete Memory.creeps[creepName];
      // console.log('Clearing non-existing creep memory:', creepName);
    } else {
      if (Object.keys(ROLES).includes(creep.memory.role)) {
        try {
          ROLES[creep.memory.role].run(creep);
        } catch (error) {
          console.log("error on creep " + creep.name + " in room " + creem.room, "\n", error);
        }
      }
    }
  }

  roomLoop();
}
