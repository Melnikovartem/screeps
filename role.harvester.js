let roleHarvester = {
  run: function(creep) {
    if (creep.store[RESOURCE_ENERGY] == 0) {
      creep.memory.fflush = false;
    }
    if(creep.store.getFreeCapacity() > 0 && !creep.memory.fflush) {
          creep.harvestSource();
      }

    let target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_EXTENSION ||
                        structure.structureType == STRUCTURE_SPAWN ||
                        structure.structureType == STRUCTURE_CONTAINER ||
                        minerContainerIds.includes(structure.id)) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
    });

    if (creep.room.energyCapacityAvailable > creep.room.energyAvailable &&
      _.filter(Game.creeps, (creepIter) => creepIter.memory.role == "hauler" && creepIter.memory.homeroom == creep.memory.homeroom).length == 0) {
        if (creep.store.getFreeCapacity() == 0 && !creep.memory.fflush){
          creep.memory.fflush = true;
        }
        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_EXTENSION ||
                            structure.structureType == STRUCTURE_SPAWN) &&
                            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
        });
      }

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
  },
  coolName: "Andrena ",
  spawn: function(room) {
    let target = _.get(room.memory, ["roles", "harvester", 2]);
    let real   = _.filter(Game.creeps, (creep) => creep.memory.role == "harvester" && creep.memory.homeroom == room.name).length

    if (real >= target) {
      return
    }

    let spawnSettings = {}
    spawnSettings.bodyParts = [WORK,WORK,WORK,WORK,WORK,CARRY,MOVE,MOVE,MOVE];
    spawnSettings.memory    =  { role: "harvester", born: Game.time, homeroom: room.name, fflush: false };

    return spawnSettings;
  },
}


module.exports = roleHarvester;
