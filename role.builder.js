var roleFunctions = require('role.functions');

var roleBuilder = {

    /** @param {Creep} creep **/
    run: function(creep) {
	    if(creep.memory.building && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.building = false;
            creep.say('🔄 harvest');
	    }
	    if(!creep.memory.building && creep.store.getFreeCapacity() == 0) {
	        creep.memory.building = true;
	        creep.say('🚧 build');
	    }

	    if(creep.memory.building) {
          // remove with addition of Tower
          var repairTarget = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (structure) => structure.hits < structure.hitsMax
            });
          if (repairTarget) {
              if(creep.repair(repairTarget) == ERR_NOT_IN_RANGE) {
                  creep.moveTo(repairTarget);
              }
          } else {
            var buildTarget = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
            if(buildTarget) {
                if(creep.build(buildTarget) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(buildTarget);
                }
            }
          }
	    }
	    else {
	        roleFunctions.getEnergyFromStorage(creep);
	    }
	}
};

module.exports = roleBuilder;
