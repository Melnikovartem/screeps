function roomDefense(room) {
  for (var name in Game.structures) {
    var structure = Game.structures[name];

    if (structure.structureType == STRUCTURE_TOWER) {
      var closestHostile = structure.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
      if (closestHostile) {
        structure.attack(closestHostile);
      } else if (structure.store.getFreeCapacity(RESOURCE_ENERGY) < structure.store.getCapacity(RESOURCE_ENERGY) * 0.4) {
        var closestDamagedStructure = structure.pos.findClosestByRange(FIND_STRUCTURES, {
          filter: (structure) => ((structure.structureType == STRUCTURE_WALL) &&
              structure.hits < 10000) ||
            ((structure.structureType == STRUCTURE_RAMPART) &&
              structure.hits < 10000) ||
            ((structure.structureType != STRUCTURE_WALL &&
                structure.structureType != STRUCTURE_RAMPART) &&
              structure.hits < structure.hitsMax * 0.9)
        });


        if (closestDamagedStructure) {
          structure.repair(closestDamagedStructure);
        }
      }
    }
  }
}


module.exports = roomDefense;