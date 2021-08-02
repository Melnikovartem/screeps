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
        let repairSheet = {
          [STRUCTURE_RAMPART]: 200000,
          [STRUCTURE_WALL]: 200000,
          other: 1,
        }

        let closestDamagedStructure = structure.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: (structure) => (repairSheet[structure.structureType] &&
              structure.hits < repairSheet[structure.structureType]) ||
            (!repairSheet[structure.structureType] &&
              structure.hits < structure.hitsMax * repairSheet["other"])
        });

        if (closestDamagedStructure) {
          if (creep.pos.getRangeTo(closestDamagedStructure) > 3) {
            creep.moveTo(closestDamagedStructure, {
              reusePath: REUSE_PATH
            });
          } else {
            creep.repair(closestDamagedStructure);
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
      building: false,

      // here also can be some _target cashing
    };

    spawnSettings.postSpawn = function() {
      console.log("spawned a " + roleName + " in " + room.name);
    };

    return spawnSettings;
  },
}

module.exports = roleBuilder;