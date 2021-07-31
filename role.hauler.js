let roleUpgrader  = {
  run: function(creep) {
    if(creep.memory.hauling && creep.store[RESOURCE_ENERGY] == 0) {
        creep.memory.hauling = false;
        creep.say('🔄');
    }

    if(!creep.memory.hauling) {
      let ans = creep.getEnergyFromContainer();
      if(ans == OK) {
          creep.memory.hauling = true;
          creep.say('➡');
      }
    }

    let target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_EXTENSION ||
                            structure.structureType == STRUCTURE_SPAWN ||
                            structure.structureType == STRUCTURE_TOWER ||
                            storageContainerIds.includes(structure.id)) &&
                            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
      });

      if (creep.memory.hauling) {
        if(!creep.pos.isNearTo(target)) {
          creep.moveTo(target);
        }
        creep.transfer(target, RESOURCE_ENERGY);
      }
  },

  bodyParts: [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE],
  coolName: "Bumblebee ",
}

module.exports = roleUpgrader;
