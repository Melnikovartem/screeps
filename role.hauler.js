let roleUpgrader = {
  run: function(creep) {

    if (creep.memory.hauling) {
      // prob coud add target cashing (!smart)

      // spawners need to be filled
      let target = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
        filter: (structure) => {
          return (structure.structureType == STRUCTURE_EXTENSION ||
              structure.structureType == STRUCTURE_SPAWN) &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
      });

      if (!target) {
        // towers need to be filled
        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: (structure) => {
            structure.store && structure.structureType == STRUCTURE_TOWER &&
              structure.store.getCapacity(RESOURCE_ENERGY) * 0.9 >= structure.store.getUsedCapacity(RESOURCE_ENERGY)
          }
        });
      }

      if (!target) {
        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: (structure) => (structure.structureType == STRUCTURE_STORAGE || storageContainerIds.includes(structure.id))
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
      let ans = ERR_NOT_FOUND;
      if (creep.room.energyCapacityAvailable > creep.room.energyAvailable && creep.room.controller && creep.room.controller.my) {
        // JUST GET ME ENERGY BITCH
        ans = creep.getEnergyFromStorage();
      }
      if (ans == ERR_NOT_FOUND) {
        // WELL TIME TO GET SOME WORK DONE FROM FUCKING HARVESTERS
        ans = creep.getEnergyFromHarvesters();
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

      // here also can be some _target cashing
    };

    spawnSettings.postSpawn = function() {
      console.log("spawned a " + roleName + " in " + room.name);
    };

    return spawnSettings;
  },
}

module.exports = roleUpgrader;