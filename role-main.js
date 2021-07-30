var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');

require('constants')

var roleMain = {

    /** @param **/
    run: function() {
      for(var name in Game.creeps) {
          var creep = Game.creeps[name];


          if(creep.memory.role == HARVESTERS_ROLENAME) {
              roleHarvester.run(creep);
          }
          if(creep.memory.role == UPGRADERS_ROLENAME) {
              roleUpgrader.run(creep);
          }
          if(creep.memory.role == BUILDERS_ROLENAME) {
              roleBuilder.run(creep);
          }
      }
	}
};


module.exports = roleMain;
