let roleBuilder = {
  run: function(creep) {
    if (creep.memory.building && creep.store[RESOURCE_ENERGY] == 0) {
      creep.memory.building = false;
      creep.say('🔄');
    }

    if (!creep.memory.building) {
      if (creep.getEnergyFromStorage() == OK) {
        creep.memory.building = true;
        creep.say('🚧');
      }
    }

    if (creep.memory.building) {
      var buildTarget = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
      if (buildTarget) {
        if (creep.pos.getRangeTo(buildTarget) > 3) {
          creep.moveTo(buildTarget, {
            reusePath: REUSE_PATH
          });
        } else {
          creep.build(buildTarget);
        }
      } else {
        var repairTargetFull = creep.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: (structure) => ((structure.structureType == STRUCTURE_WALL) &&
              structure.hits < 150000) ||
            ((structure.structureType == STRUCTURE_RAMPART) &&
              structure.hits < 150000) ||
            ((structure.structureType != STRUCTURE_WALL &&
                structure.structureType != STRUCTURE_RAMPART) &&
              structure.hits < structure.hitsMax)
        });
        if (repairTargetFull) {
          if (creep.pos.getRangeTo(repairTargetFull) > 3) {
            creep.moveTo(repairTargetFull, {
              reusePath: REUSE_PATH
            });
          } else {
            creep.repair(repairTargetFull);
          }
        }
      }
    }
  },

  coolName: "Colletidae ",
  spawn: function(room) {
    let roleName = "builder";
    let target = _.get(room.memory, ["roles", roleName], 2);
    let real = _.filter(Game.creeps, (creep) => creep.memory.role == roleName && creep.memory.homeroom == room.name).length

    if (Game.time % OUTPUT_TICK == 0) {
      console.log(roleName + ": " + real + "/" + target);
    }

    if (room.find(FIND_CONSTRUCTION_SITES).length == 0 || real >= target) {
      return
    }

    let spawnSettings = {
      bodyParts: [],
      memory: {}
    }
    let roomEnergy = 300;
    if (real < target / 2) {
      roomEnergy = room.energyAvailable;
    } else {
      roomEnergy = room.energyCapacityAvailable;
    }

    let segment = [WORK, CARRY, MOVE];
    let segmentCost = _.sum(segment, s => BODYPART_COST[s]);

    let maxSegment = Math.floor(roomEnergy / segmentCost);

    _.forEach(segment, function(s) {
      _.times(maxSegment, () => spawnSettings.bodyParts.push(s))
    });

    spawnSettings.memory = {
      role: roleName,
      born: Game.time,
      homeroom: room.name,
      building: false
    };

    spawnSettings.postSpawn = function() {};

    return spawnSettings;
  },
}

module.exports = roleBuilder;