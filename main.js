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

global.minerContainerIds = [
  "6104cfbc0a328f04a3f0937e",
  "6104d6e099c3721829eb8a0c",
];
global.storageContainerIds = [
  "61042dbc3bd544104d05ab19",
  "61042329061eb6bf68d1cede",
];

module.exports.loop = function () {

    for(let name in Game.creeps) {
        let creep = Game.creeps[name];

        if(!creep) {
            delete Memory.creeps[name];
            console.log('Clearing non-existing creep memory:', name);
        } else {
          ROLES[creep.memory.role].run(creep);
        }
    }

    roomLoop();
}
