var armyLoop = require('armies');
var roomLoop = require('rooms');

var creepFuncitons = require('role.functions');
var posFuncitons = require('pos.functions');
var utilityFuncitons = require('utility.functions');

global.ROLES = {
  hauler: require('role.hauler'),
  harvester: require('role.harvester'),
  builder: require('role.builder'),
  upgrader: require('role.upgrader'),
  knight: require('role.knight'),
};

global.OUTPUT_TICK = 200;
global.REUSE_PATH = 3;

//for developing rooms
global.storageContainerIds = [
  "61057ec20ac3811209f01e9e",
  "61058ede26c3c4bf6b825be4",
  "6104f8759f18546eddf20ab9",
  //from sim
];

module.exports.loop = function() {

  armyLoop();


  for (let creepName in Memory.creeps) {
    let creep = Game.creeps[creepName];

    if (!creep) {
      delete Memory.creeps[creepName];
      console.log('Clearing non-existing creep memory:', creepName);
    } else {
      if (Object.keys(ROLES).includes(creep.memory.role)) {
        ROLES[creep.memory.role].run(creep);
      }
    }
  }
  roomLoop();

  if (Game.cpu.bucket == 10000) {
    Game.cpu.generatePixel();
  }
}