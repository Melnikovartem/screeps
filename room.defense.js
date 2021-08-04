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
    } else if (structure.structureType == STRUCTURE_LINK && structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      if (structure.id == "610a113a21e8a68645e5fb07") { //this is a hotfix anyway //_.filter(structure.pos.findInRange(FIND_MY_STRUCTURES, 2), {structureType : STRUCTURE_STORAGE}).length) {
        let otherLinks = room.find(FIND_MY_STRUCTURES, {filter: (structureIter) => structureIter.structureType == STRUCTURE_LINK && structureIter != structure && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 50});
        if (otherLinks.length) {
          structure.transferEnergy(otherLinks[0]);
        }
      }
    }
  }
}


module.exports = roomDefense;
