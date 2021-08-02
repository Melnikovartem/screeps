function getTarget(creep, room) {
  if (!target) {
    // spawners need to be filled
    target = creep.pos.findClosestByRange(room.find(FIND_MY_STRUCTURES, {
      filter: (structure) => (structure.structureType == STRUCTURE_EXTENSION ||
          structure.structureType == STRUCTURE_SPAWN) && structure.store &&
        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    }));
  }

  if (!target) {
    // towers need to be filled
    target = creep.pos.findClosestByPath(room.find(FIND_STRUCTURES, {
      filter: (structure) => structure.structureType == STRUCTURE_TOWER && structure.store &&
        structure.store.getCapacity(RESOURCE_ENERGY) * 0.9 >= structure.store.getUsedCapacity(RESOURCE_ENERGY)
    }));

  }

  // target in room that i am checking rn is better than target in another room
  if (!target) {
    target = creep.pos.findClosestByPath(room.find(FIND_STRUCTURES, {
      filter: (structure) => (structure.structureType == STRUCTURE_STORAGE || storageContainerIds.includes(structure.id)) &&
        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    }));
  }

  return target;
}

function checkRooms(creep) {
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
    target = getTarget(creep, creep.room);
  }

  if (!target && creep.room.name != creep.memory.homeroom) {
    target = getTarget(creep, Game.rooms[creep.memory.homeroom]);
  }

  if (!target) {
    for (let annexName in Game.rooms[creep.memory.homeroom].memory.annexes) {
      if (creep.room.name != annexName) {
        target = getTarget(creep, Game.rooms[annexName]);
        if (target) {
          break;
        }
      }
    }
  }

  return target;
}


let roleName = "hauler";
let roleHauler = {
  run: function(creep) {

    if (creep.memory._target) {
      target = checkRooms(creep);

      if (target) {
        // this can also be done in checkRooms if needed;
        creep.memory._target = {
          id: target.id,
          time: Game.time,
        };

        if (!creep.pos.isNearTo(target)) {
          creep.moveTo(target, {
            reusePath: REUSE_PATH
          });
        } else {
          creep.transfer(target, RESOURCE_ENERGY);
        }
      } else if (creep.room.name != creep.memory.homeroom) {
        creep.moveToRoom(creep.memory.homeroom);
      }

      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
        creep.memory._target = 0;
        creep.say('🔄');
      } else if (!target) {
        // some fail-safes
        if (creep.room.name != creep.memory.homeroom) {
          creep.moveToRoom(creep.memory.homeroom)
        } else if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          creep.memory._target = 0;
          creep.say('🔄');
        }
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

    spawnSettings.postSpawn = function(creepName) {
      console.log("spawned a " + roleName + " named " + creepName + " in " + room.name);
    };

    return spawnSettings;
  },
}

module.exports = roleHauler;