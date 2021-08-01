let roleUpgrader = {
  run: function(creep) {

    if (!creep.memory.introduced) {
      creep.memory.introduced = 1;
    }

    if (creep.memory.hauling) {
      let target = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
        filter: (structure) => {
          return (structure.structureType == STRUCTURE_EXTENSION ||
              structure.structureType == STRUCTURE_SPAWN) &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
      });

      if (!target) {
        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: (structure) => {
            if (structure.store) {
              return (structure.structureType == STRUCTURE_TOWER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > structure.store.getCapacity(RESOURCE_ENERGY) * 0.1) ||
                (!minerContainerIds.includes(structure.id) && structure.store.getFreeCapacity(RESOURCE_ENERGY) >= creep.store.getUsedCapacity(RESOURCE_ENERGY))
            }
          }
        });
      }

      if (!target) {
        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: (structure) => {
            return (structure.structureType == STRUCTURE_TOWER || !minerContainerIds.includes(structure.id)) &&
              structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
          }
        });
      }

      if (!target) {
        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: (structure) => {
            return (structure.structureType == STRUCTURE_STORAGE)
          }
        });
      }

      if ((!target && creep.store.getFreeCapacity(RESOURCE_ENERGY) != 0) || creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
        creep.memory.hauling = false;
        creep.say('🔄');
      }

      if (!creep.pos.isNearTo(target)) {
        creep.moveTo(target, {
          reusePath: REUSE_PATH
        });
      }
      creep.transfer(target, RESOURCE_ENERGY);
    }

    if (!creep.memory.hauling) {
      let ans = creep.getEnergyFromHarvesters()
      if (ans == ERR_NOT_FOUND && creep.room.energyCapacityAvailable > creep.room.energyAvailable) {
        ans = creep.getEnergyFromStorage()
      }
      if (ans == ERR_NOT_FOUND) {
        creep.moveTo(Game.getObjectById(creep.memory.target_harvester));
        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) == 0) {
          ans = OK;
        }
      }
      if (ans == OK) {
        creep.memory.hauling = true;
        creep.say('➡');
      }
    }
  },

  coolName: "Bumblebee ",
  spawn: function(room) {
    let roleName = "hauler";
    let target = _.get(room.memory, ["roles", roleName], 2);
    let real = _.filter(Game.creeps, (creep) => creep.memory.role == roleName && creep.memory.homeroom == room.name).length

    if (real >= target) {
      return
    }

    let spawnSettings = {
      bodyParts: [],
      memory: {}
    }
    let roomEnergy = 300;
    if (real == 0) {
      roomEnergy = room.energyAvailable;
    } else {
      roomEnergy = room.energyCapacityAvailable;
    }

    let segment = [CARRY, CARRY, MOVE];
    let segmentCost = _.sum(segment, s => BODYPART_COST[s]);

    let maxSegment = Math.floor(roomEnergy / segmentCost);

    _.forEach(segment, function(s) {
      _.times(maxSegment, () => spawnSettings.bodyParts.push(s))
    });

    spawnSettings.memory = {
      role: roleName,
      born: Game.time,
      homeroom: room.name,
      hauling: false,
    };

    spawnSettings.postSpawn = function() {
      console.log("spawned a " + roleName + " in " + room.name);
    };

    return spawnSettings;
  },
}

module.exports = roleUpgrader;