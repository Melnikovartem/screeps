var roleFunctions = require('role.functions');

var roleHarvester = {

    /** @param {Creep} creep **/
    run: function(creep) {
      if (creep.store[RESOURCE_ENERGY] == 0) {
        creep.memory.fflush = false;
      }
	    if(creep.store.getFreeCapacity() > 0 && !creep.memory.fflush) {
            roleFunctions.harvestClosesSource(creep);
        }
      else if (creep.store.getFreeCapacity() == 0 && !creep.memory.fflush){
        creep.memory.fflush = true;
      }
      else {
        var target = null;
        if (Game.rooms['E21S57'].energyAvailable < 550) {
          target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                  filter: (structure) => {
                      return (structure.structureType == STRUCTURE_EXTENSION ||
                              structure.structureType == STRUCTURE_SPAWN) &&
                              structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                  }
          });
        }
        if (!target) {
          target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                  filter: (structure) => {
                      return (structure.structureType == STRUCTURE_EXTENSION ||
                              structure.structureType == STRUCTURE_SPAWN ||
                              structure.structureType == STRUCTURE_TOWER ||
                              structure.structureType == STRUCTURE_CONTAINER) &&
                              structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                  }
          });
        }

          if (target) {
              if(creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                  creep.moveTo(target);
              }
          } else {
            creep.moveTo(Game.spawns['Spawn1']);
            if (creep.store.getFreeCapacity() > 0) {
              creep.memory.fflush = false;
            }
          }
        }
	}
};

module.exports = roleHarvester;
