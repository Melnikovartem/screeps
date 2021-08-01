let roleUpgrader = {
  run: function(creep) {
    if (creep.memory.upgrading && creep.store[RESOURCE_ENERGY] == 0) {
      creep.memory.upgrading = false;
      creep.say('🔄');
    }

    if (!creep.memory.upgrading) {
      if (creep.getEnergyFromStorage() == OK) {
        creep.memory.upgrading = true;
        creep.say('⚡');
      }
    }

    if (creep.memory.upgrading) {
      if (creep.pos.getRangeTo(creep.room.controller) > 3) {
        creep.moveTo(creep.room.controller, {
          reusePath: REUSE_PATH
        });
      } else {
        creep.upgradeController(creep.room.controller)
      }
    }
  },
  coolName: "Honey bee ",
  spawn: function(room) {
    let roleName = "upgrader";
    let target = _.get(room.memory, ["roles", roleName], 2);
    let real = _.filter(Game.creeps, (creep) => creep.memory.role == roleName && creep.memory.homeroom == room.name).length

    if (Game.time % OUTPUT_TICK == 0) {
      console.log(roleName + ": " + real + "/" + target);
    }

    if (real >= target) {
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
      upgrading: false
    };

    spawnSettings.postSpawn = function() {};

    return spawnSettings;
  },
}

module.exports = roleUpgrader;