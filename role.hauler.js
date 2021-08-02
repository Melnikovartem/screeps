let roleUpgrader = {
  run: function(creep) {

    if (creep.memory._target) {
      // target cashing (!smart)
      let target;
      if (creep.memory._target && Game.time - creep.memory._target.time <= 50) {
        target = Game.getObjectById(creep.memory._target.id);
        // target is still valid;
        if (!target || target.store.getFreeCapacity(RESOURCE_ENERGY) == 0) {
          target = 0;
        }
      }

      if (!target) {
        // spawners need to be filled
        target = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
          filter: (structure) => (structure.structureType == STRUCTURE_EXTENSION ||
              structure.structureType == STRUCTURE_SPAWN) && structure.store &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
      }

      if (!target) {
        // towers need to be filled
        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: (structure) => structure.structureType == STRUCTURE_TOWER && structure.store &&
            structure.store.getCapacity(RESOURCE_ENERGY) * 0.9 >= structure.store.getUsedCapacity(RESOURCE_ENERGY)
        });

      }

      if (!target) {
        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: (structure) => (structure.structureType == STRUCTURE_STORAGE || storageContainerIds.includes(structure.id)) &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
      }

      if (target) {
        if (!creep.pos.isNearTo(target)) {
          creep.memory._target = {
            id: target.id,
            time: Game.time,
          };
          creep.moveTo(target, {
            reusePath: REUSE_PATH
          });
        } else {
          creep.transfer(target, RESOURCE_ENERGY);
        }
      }

      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0 || (!target && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0)) {
        creep.memory._target = 0;
        creep.say('🔄');
      }
    }

    if (!creep.memory._target) {
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
        creep.memory._target = {};
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

      // here also can be some _target cashing
    };

    spawnSettings.postSpawn = function() {
      console.log("spawned a " + roleName + " in " + room.name);
    };

    return spawnSettings;
  },
}

module.exports = roleUpgrader;