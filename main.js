var roomLoop = require('rooms');
var roleLoop = require('roles');

var creepFuncitons = require('role.functions');
var posFuncitons = require('pos.functions');

global.ROLES = {
  harvester: require('role.harvester'),
  hauler:    require('role.hauler'),
  builder:   require('role.builder'),
  upgrader:  require('role.upgrader'),
};

global.OUTPUT_TICK = 200;
global.RESUSE_PATH = 3;

global.minerContainerIds = [
  "6104cfbc0a328f04a3f0937e",
  "6104d6e099c3721829eb8a0c",
];
global.storageContainerIds = [
  "61058ede26c3c4bf6b825be4",
  "61057ec20ac3811209f01e9e",
  "6104f8759f18546eddf20ab9",
];

module.exports.loop = function () {

    if (Game.cpu.bucket == 10000) {
      Game.cpu.generatePixel();
    }

    let prevCPU = Game.cpu.getUsed();
    for(let name in Memory.creeps) {
        let creep = Game.creeps[name];

        if(!creep) {
            delete Memory.creeps[name];
            console.log('Clearing non-existing creep memory:', name);
        } else {
          // prevCPU = Game.cpu.getUsed();
          ROLES[creep.memory.role].run(creep);
          // if (Game.time % 2 == 0 && creep.memory.role == "harvester") { console.log("On " + name + ": " + (Game.cpu.getUsed() - prevCPU)); }
        }
    }
    // if (Game.time % 2 == 0) { console.log("----") }
    roomLoop();
}
