var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');

require('constants')

function roleLoop() {
    for(var name in Game.creeps) {
        var creep = Game.creeps[name];

        if(creep.memory.role == HARVESTERS_ROLENAME) {
            roleHarvester(creep);
        }
        if(creep.memory.role == UPGRADERS_ROLENAME) {
            roleUpgrader(creep);
        }
        if(creep.memory.role == BUILDERS_ROLENAME) {
            roleBuilder(creep);
        }
    }
}


module.exports = roleLoop;
