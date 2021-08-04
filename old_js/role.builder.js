function checkRoomForTargets(room, targetType = "build") {
  //return build, repair OR nothing if no targets
  let targets;
  if (targetType == "build") {
    targets = room.find(FIND_CONSTRUCTION_SITES).length;
  } else if (targetType == "repair") {
    targets = room.find(FIND_STRUCTURES, {
      filter: (structure) => (repairSheet[structure.structureType] &&
          structure.hits < repairSheet[structure.structureType]) ||
        (!repairSheet[structure.structureType] &&
          structure.hits < structure.hitsMax * repairSheet["other"])
    }).length;
    console.log(targets);
  } else if (targetType == "repair_emergency") {
    targets = room.find(FIND_STRUCTURES, {
      filter: (structure) => (repairSheet[structure.structureType] &&
          structure.hits < repairSheet[structure.structureType] * repairSheet["collapse"]) ||
        (!repairSheet[structure.structureType] &&
          structure.hits < structure.hitsMax * repairSheet["other"] * repairSheet["collapse"])
    }).length;
  }
  return targets;
}

function checkRoomsForTargets(creep, targetType) {
  creep.memory._target.type = targetType;

  if (creep.room.name != creep.memory.homeroom) {
    if (checkRoomForTargets(Game.rooms[creep.memory.homeroom], targetType)) {
      creep.memory._target.room = creep.memory.homeroom;
    }
  }

  if (!creep.memory._target.room) {
    for (let annexName in Game.rooms[creep.memory.homeroom].memory.annexes) {
      if (creep.room.name != annexName) {
        if (checkRoomForTargets(Game.rooms[annexName], targetType)) {
          creep.memory._target.room = annexName;
          break;
        }
      }
    }
  }

  if (!creep.memory._target.room && targetType == "repair") {
    creep.memory._target.room = creep.memory.homeroom;
  }
}

// prob can set it in room memory for different types of rooms
let repairSheet = {
  [STRUCTURE_RAMPART]: 200000,
  [STRUCTURE_WALL]: 200000,
  other: 1,
  collapse: 0.5
}

let roleName = "builder";
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
      // target cashing (!smart)
      let target;
      if (creep.memory._target != null && Game.time - creep.memory._target.time <= 50) {
        target = Game.getObjectById(creep.memory._target.id);

        if (!target ||
          ((creep.memory._target.type == "repair" || creep.memory._target.type == "repair_emergency") &&
            (repairSheet[target.structureType] && target.hits < repairSheet[target.structureType]) ||
            (!repairSheet[target.structureType] && target.hits < target.hitsMax * repairSheet["other"]))) {
          target = null;
        }
      }


      if (!target || !creep.memory._target || (creep.room.name == creep.memory._target.room && creep.memory._target.id == 0)) {
        creep.memory._target = {
          id: 0,
          time: Game.time,
          room: 0,
        }
      }

      if (!target && !creep.memory._target.room) {
        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: (structure) =>
            (repairSheet[structure.structureType] &&
              structure.hits < repairSheet[structure.structureType] * repairSheet["collapse"]) ||
            (!repairSheet[structure.structureType] &&
              structure.hits < structure.hitsMax * repairSheet["other"] * repairSheet["collapse"])
        });
        if (target) {
          creep.memory._target = {
            id: target.id,
            time: Game.time,
            room: target.room.name,
            type: "repair_emergency",
          };
        }
      }

      if (!target && !creep.memory._target.room) {
        checkRoomsForTargets(creep, "repair_emergency");
      }

      if (!target && !creep.memory._target.room) {
        target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
        if (target) {
          creep.memory._target = {
            id: target.id,
            time: Game.time,
            room: target.room.name,
            type: "build"
          };
        }
      }

      if (!target && !creep.memory._target.room) {
        checkRoomsForTargets(creep, "build");
      }

      if (!target && !creep.memory._target.room) {
        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: (structure) => (repairSheet[structure.structureType] &&
              structure.hits < repairSheet[structure.structureType]) ||
            (!repairSheet[structure.structureType] &&
              structure.hits < structure.hitsMax * repairSheet["other"])
        });
        if (target) {
          creep.memory._target = {
            id: target.id,
            time: Game.time,
            room: target.room.name,
            type: "repair",
          };
        }
      }

      if (!target && !creep.memory._target.room) {
        checkRoomsForTargets(creep, "repair");
      }

      if (target) {
        if (creep.pos.getRangeTo(target) > 3) {
          creep.moveTo(target, {
            reusePath: REUSE_PATH
          });
        } else {
          if (creep.memory._target.type == "build") {
            creep.build(target);
          } else if (creep.memory._target.type == "repair" || creep.memory._target.type == "repair_emergency") {
            creep.repair(target);
          }
          // didnt add fail-safe, but i added _target.type for all cases higher
        }
      } else if (creep.memory._target.room) {
        creep.moveToRoom(creep.memory._target.room);
      }
    }
  },

  coolName: "Colletidae ",
  spawn: function(room) {
    let target = _.get(room.memory, ["roles", roleName], 2);
    let real = _.filter(Game.creeps, (creep) => creep.memory.role == roleName && creep.memory.homeroom == room.name).length

    if (real >= target) {
      return
    }

    console.log("targets in this room:", checkRoomForTargets(room, "build") + checkRoomForTargets(room, "repair_emergency"));
    if ((checkRoomForTargets(room, "build") + checkRoomForTargets(room, "repair_emergency")) == 0) {
      let annexTargets = 0;
      for (let annexName in room.memory.annexes) {
        console.log(annexName, Game.rooms[annexName]);
        let annex = Game.rooms[annexName];
        if (annex) {
          console.log("targets in annex " + annexName + ":", checkRoomForTargets(annex, "build") + checkRoomForTargets(annex, "repair_emergency"));
          annexTargets = Math.max(annexTargets, checkRoomForTargets(annex, "build") + checkRoomForTargets(annex, "repair_emergency"));
          if (annexTargets) {
            break;
          }
        }
      }
      if (annexTargets == 0) {
        // no work for my BUILDers POG
        return;
      }
    }

    let spawnSettings = {
      bodyParts: [],
      memory: {}
    };

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

      // also can be some _target cashing
    };

    spawnSettings.postSpawn = function(creepName) {
      console.log("spawned a " + roleName + " named " + creepName + " in " + room.name);
    };

    return spawnSettings;
  },
}

module.exports = roleBuilder;