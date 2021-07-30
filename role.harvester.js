let roleHarvester = {
  run: function(creep) {
    if (creep.store[RESOURCE_ENERGY] == 0) {
      creep.memory.fflush = false;
    }
    if(creep.store.getFreeCapacity() > 0 && !creep.memory.fflush) {
          creep.harvestSource();
      }
    else if (creep.store.getFreeCapacity() == 0 && !creep.memory.fflush){
      creep.memory.fflush = true;
    }

    let target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_EXTENSION ||
                        structure.structureType == STRUCTURE_SPAWN ||
                        structure.structureType == STRUCTURE_TOWER ||
                        structure.structureType == STRUCTURE_CONTAINER) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
    });

    if (creep.pos.isNearTo(target) || creep.memory.fflush) {
        if(creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
        }
    }

    if (!target) {
      if (creep.store.getFreeCapacity() > 0) {
        creep.memory.fflush = false;
      }
    }
  }
}


module.exports = roleHarvester;
