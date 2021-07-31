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
                            structure.structureType == STRUCTURE_SPAWN)  &&
                            structure.store.getFreeCapacity() > 0;
                }
      });

      if(!target) {
        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_TOWER ||
                                storageContainerIds.includes(structure.id)) &&
                                structure.store.getFreeCapacity() > structure.store.getCapacity() * 0.1;
                    }
          });
      }

      if (creep.room.energyAvailable < creep.room.energyCapacityAvailable) {
          target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                  filter: (structure) => {
                      return (structure.structureType == STRUCTURE_EXTENSION ||
                              structure.structureType == STRUCTURE_SPAWN) &&
                              structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                  }
          });
        }

      if (creep.memory.hauling) {
        if(!creep.pos.isNearTo(target)) {
          creep.moveTo(target);
        }
        creep.transfer(target, RESOURCE_ENERGY);
      }
  },

  coolName: "Bumblebee ",
  spawn: function(room) {
    let target = _.get(room.memory, ["roles", "hauler", 2]);
    let real   = _.filter(Game.creeps, (creep) => creep.memory.role == "hauler" && creep.memory.homeroom == room.name).length

    if (real >= target) {
      return
    }

    let spawnSettings = {}
    spawnSettings.bodyParts = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
    spawnSettings.memory    =  { role: "hauler", born: Game.time, homeroom: room.name, hauling: false };

    return spawnSettings;
  },
}

module.exports = roleUpgrader;
