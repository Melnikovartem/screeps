function roomDefense(room) {
    for(var name in Game.structures) {
        var structure = Game.structures[name];

        if(structure.structureType == STRUCTURE_TOWER) {
            var closestHostile = structure.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            if(closestHostile) {
                tower.attack(closestHostile);
            }

            var closestDamagedStructure = structure.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (structureIter) => ((structureIter.structureType != STRUCTURE_WALL &&
                                            structureIter.structureType != STRUCTURE_RAMPART) &&
                                            structureIter.hits < structure.hitsMax)
            });
            if(closestDamagedStructure) {
                structure.repair(closestDamagedStructure);
            }
        }
    }
}


module.exports = roomDefense;
