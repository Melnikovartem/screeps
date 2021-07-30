var roomLoop = require('rooms');
var roleLoop = require('roles');

var creepFuncitons = require('role.functions');
var posFuncitons = require('pos.functions');

global.ROLES = {
  harvester: require('role.harvester'),
  builder:   require('role.builder'),
  upgrader:  require('role.upgrader'),
};

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
