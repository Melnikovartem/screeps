let roleUpgrader = {
  run: function(creep) {
    // this guy prob never leaves homeroom
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
      // fail-safe for early game
      if (creep.room.name == creep.memory.homeroom) {
        if (creep.pos.getRangeTo(creep.room.controller) > 3) {
          creep.moveTo(creep.room.controller, {
            reusePath: REUSE_PATH
          });
        } else {
          // will need to set some rules based on mining / controller lvl (latter is more important)
          creep.upgradeController(creep.room.controller);
        }
      } else {
        creep.moveToRoom(creep.memory.homeroom);
      }
    }
  },
  coolName: "Honey bee ",
  spawn: function(room) {
    let roleName = "upgrader";
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
      upgrading: false,

      // also can be some _target cashing
    };

    spawnSettings.postSpawn = function(creepName) {
      console.log("spawned a " + roleName + " named " + creepName + " in " + room.name);
    };

    return spawnSettings;
  },
}

module.exports = roleUpgrader;