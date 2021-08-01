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

global.minerContainerIds = [
  "6104cfbc0a328f04a3f0937e",
  "6104d6e099c3721829eb8a0c",

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