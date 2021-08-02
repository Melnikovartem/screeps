function roomDefense(room) {
  for (var name in Game.structures) {
    var structure = Game.structures[name];

    if (structure.structureType == STRUCTURE_TOWER) {
      let closestHostile = structure.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
      if (closestHostile) {
        structure.attack(closestHostile);
      } else if (structure.store.getFreeCapacity(RESOURCE_ENERGY) < structure.store.getCapacity(RESOURCE_ENERGY) * 0.4) {
        let repairSheet = {
          [STRUCTURE_RAMPART]: 100000,
          [STRUCTURE_WALL]: 10000,
          other: 0.7,
        }

        let closestDamagedStructure = structure.pos.findClosestByRange(FIND_STRUCTURES, {
          filter: (structure) => (repairSheet[structure.structureType] &&
              structure.hits < repairSheet[structure.structureType]) ||
            (!repairSheet[structure.structureType] &&
              structure.hits < structure.hitsMax * repairSheet["other"])
        });


        if (closestDamagedStructure) {
          structure.repair(closestDamagedStructure);
        }
      }
    }
  }
}


module.exports = roomDefense;