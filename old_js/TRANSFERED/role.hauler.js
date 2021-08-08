function checkRoomForTargets(room) {
  //return something OR nothing if no targets

  let targets = room.find(FIND_MY_STRUCTURES, {
    filter: (structure) => (structure.structureType == STRUCTURE_EXTENSION ||
        structure.structureType == STRUCTURE_SPAWN) && structure.store &&
      structure.store && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
  }).length;

  if (!targets) {
    targets = room.find(FIND_STRUCTURES, {
      filter: (structure) => structure.store && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    }).length;
  }

  return targets;
}

function checkRoomsForTargets(creep) {
  creep.memory._target = {
    time: Game.time,
    room: 0,
  }

  if (creep.room.name != creep.memory.homeroom) {
    if (checkRoomForTargets(Game.rooms[creep.memory.homeroom])) {
      creep.memory._target.room = creep.memory.homeroom;
    }
  }

  if (!creep.memory._target.room) {
    for (let annexName in Game.rooms[creep.memory.homeroom].memory.annexes) {
      if (creep.room.name != annexName) {
        let annex = Game.rooms[annexName];
        if (annex && checkRoomForTargets(annex)) {
          creep.memory._target.room = annexName;
          break;
        }
      }
    }
  }

  if (!creep.memory._target.room) {
    creep.memory._target.room = creep.memory.homeroom;
  }
}


let roleName = "hauler";
let roleHauler = {
  run: function(creep) {
    // just reffiled, but a lot of space left 65% +
    if (creep.memory._target == {} && 200 >= creep.store.getUsedCapacity(RESOURCE_ENERGY)) {
      creep.memory._target = null;
      creep.say('🔄');
    }

    if (creep.memory._target) {
      if (creep.memory._target.room && creep.room.name != creep.memory._target.room && Game.time - creep.memory._target.time <= 50) {
        creep.moveToRoom(creep.memory._target.room);
      } else {
        // target cashing (!smart)
        let target;
        if (Game.time - creep.memory._target.time <= 50) {
          target = Game.getObjectById(creep.memory._target.id);
          // target is still valid;
          if (!target || target.store.getFreeCapacity(RESOURCE_ENERGY) == 0) {
            target = null;
          }
        }

        target = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
          filter: (structure) => (structure.structureType == STRUCTURE_EXTENSION ||
              structure.structureType == STRUCTURE_SPAWN) && structure.store &&
            structure.store && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });

        if (!target) {
          // towers need to be filled
          target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (structure) => structure.structureType == STRUCTURE_TOWER &&
              structure.store && structure.store.getCapacity(RESOURCE_ENERGY) * 0.75 >= structure.store.getUsedCapacity(RESOURCE_ENERGY)
          });
        }

        if (!target) {
          // link near storage
          target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (structure) => structure.structureType == STRUCTURE_LINK &&
              structure.store.getUsedCapacity(RESOURCE_ENERGY) == 0 &&
              _.filter(structure.pos.findInRange(FIND_MY_STRUCTURES, 2), {structureType : STRUCTURE_STORAGE}).length
          });
        }

        // target in room that i am checking rn is better than target in another room
        if (!target) {
          target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (structure) => (structure.structureType == STRUCTURE_STORAGE) &&
              structure.store && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
          });
        }

        if (target) {
          // this can also be done in checkRooms if needed;
          creep.memory._target = {
            id: target.id,
            time: Game.time,
            room: target.room.name,
          };

          if (!creep.pos.isNearTo(target)) {
            creep.moveTo(target, {
              reusePath: REUSE_PATH
            });
          } else {
            creep.transfer(target, RESOURCE_ENERGY);
          }
        } else {
          // no targets in this room
          checkRoomsForTargets(creep);
        }

        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
          creep.memory._target = null;
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

      if (ans == ERR_NOT_FOUND && Game.getObjectById("610a113a21e8a68645e5fb07").store.getFreeCapacity(RESOURCE_ENERGY) >= 200) {
        //hot fix to fill up link
        ans = creep.getEnergyFromStorage();
      }

      //this is a dangerous if cause now i need to FEED my boys if i want my energy delivered
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

    let spawnSettings = {};

    let roomEnergy = 300;
    if (real == 0) {
      roomEnergy = room.energyAvailable;
    } else {
      roomEnergy = room.energyCapacityAvailable;
    }

    spawnSettings.bodyParts = [];
    //early game fail safe
    if (room.controller.level < 3) {
      spawnSettings.bodyParts = [WORK];
    }
    let fixedCosts = _.sum(spawnSettings.bodyParts, s => BODYPART_COST[s]);

    let segment = [CARRY, CARRY, MOVE];
    let segmentCost = _.sum(segment, s => BODYPART_COST[s]);

    let maxSegment = Math.floor((roomEnergy - fixedCosts) / segmentCost);

    _.forEach(segment, function(s) {
      _.times(maxSegment, () => spawnSettings.bodyParts.push(s))
    });

    spawnSettings.memory = {
      role: roleName,
      born: Game.time,
      homeroom: room.name,

      // also can be some _target cashing
    };

    spawnSettings.postSpawn = function(creepName) {
      console.log("spawned a " + roleName + " named " + creepName + " in " + room.name);
    };

    return spawnSettings;
  },
}

module.exports = roleHauler;
