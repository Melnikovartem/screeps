function roomDefense(room) {
  for (var name in Game.structures) {
    var structure = Game.structures[name];

    if (structure.structureType == STRUCTURE_TOWER) {
      let closestHostile = structure.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
      if (closestHostile) {
        structure.attack(closestHostile);
      } else if (structure.store.getUsedCapacity(RESOURCE_ENERGY) > structure.store.getCapacity(RESOURCE_ENERGY) * 0.7) {
        let repairSheet = {
          [STRUCTURE_RAMPART]: 100000,
          [STRUCTURE_WALL]: 100000,
          other: 0.7,
        }

        let closestDamagedStructure = structure.pos.findClosestByRange(FIND_STRUCTURES, {
          filter: (structureIter) => (repairSheet[structureIter.structureType] &&
              structureIter.hits < repairSheet[structureIter.structureType]) ||
            (!repairSheet[structureIter.structureType] &&
              structureIter.hits < structureIter.hitsMax * repairSheet["other"])
        });

        if (closestDamagedStructure) {
          structure.repair(closestDamagedStructure);
        }
      }
    }
  }
}


module.exports = roomDefense;