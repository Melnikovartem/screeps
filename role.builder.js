function roleBuilder(creep) {
    if(creep.memory.building && creep.store[RESOURCE_ENERGY] == 0) {
          creep.memory.building = false;
          creep.say('🔄');
    }

    if(!creep.memory.building) {
      if(creep.getEnergyFromStorage(creep)) {
          creep.memory.building = true;
          creep.say('🚧');
      }
    }

    if(creep.memory.building) {
        var buildTarget = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
        if(buildTarget) {
          if(creep.pos.getRangeTo(buildTarget) > 3) {
            creep.moveTo(buildTarget);
          } else {
            creep.build(buildTarget);
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
            if(creep.pos.getRangeTo(repairTargetFull) > 3) {
              creep.moveTo(repairTargetFull);
            } else {
              creep.repair(repairTargetFull);
            }
          }
        }
    }
}

module.exports = roleBuilder;
