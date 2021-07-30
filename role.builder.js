var roleBuilder = {

    /** @param {Creep} creep **/
    run: function(creep) {
	    if(creep.memory.building && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.building = false;
            creep.say('🔄');
	    }
	    if(!creep.memory.building && creep.store.getFreeCapacity() == 0) {
	        creep.memory.building = true;
	        creep.say('🚧');
	    }

	    if(creep.memory.building) {
          // remove with addition of Tower
          var repairTarget = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => (structure.structureType != STRUCTURE_WALL) &&
                                          structure.hits < structure.hitsMax * 0.5
            });
          if (repairTarget) {
              if(creep.repair(repairTarget) == ERR_NOT_IN_RANGE) {
                  creep.moveTo(repairTarget);
              }
          } else {
            var buildTarget = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
            if(buildTarget) {
                if(creep.build(buildTarget) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(buildTarget);
                }
            } else {
              var repairTargetFull = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (structure) => ((structure.structureType == STRUCTURE_WALL) &&
                                              structure.hits < structure.hitsMax * 0.0003)
                                          || ((structure.structureType == STRUCTURE_RAMPART) &&
                                              structure.hits < structure.hitsMax * 0.7)
                                          || ((structure.structureType != STRUCTURE_WALL &&
                                               structure.structureType != STRUCTURE_RAMPART) &&
                                              structure.hits < structure.hitsMax)
                });
              if (repairTargetFull) {
                  if(creep.repair(repairTargetFull) == ERR_NOT_IN_RANGE) {
                      creep.moveTo(repairTargetFull);
                  }
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
