var buildingTower = {

    /** @param {Tower} tower **/
    run: function(tower) {

      var closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
      if(closestHostile) {
          tower.attack(closestHostile);
      }

	    var closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
          filter: (structure) => ((structure.structureType == STRUCTURE_WALL) &&
                                    structure.hits < structure.hitsMax * 0.0003)
                                || ((structure.structureType != STRUCTURE_WALL) &&
                                    structure.hits < structure.hitsMax)
      });
      if(closestDamagedStructure) {
          tower.repair(closestDamagedStructure);
      }
    }
};


module.exports = buildingTower;
