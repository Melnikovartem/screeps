function getTargetBuild(creep, room) {
  target = creep.pos.findClosestByPath(room.find(FIND_STRUCTURES));
  if (target) {
    creep.memory._target = {
      id: target.id,
      time: Game.time,
      type: "build"
    };
  }

  return target;
}

function getTargetRepair(creep, room) {
  // prob can set it in room memory for different types of rooms
  let repairSheet = {
    [STRUCTURE_RAMPART]: 200000,
    [STRUCTURE_WALL]: 200000,
    other: 1,
  }

  target = creep.pos.findClosestByPath(room.find(FIND_STRUCTURES), {
    filter: (structure) => (repairSheet[structure.structureType] &&
        structure.hits < repairSheet[structure.structureType]) ||
      (!repairSheet[structure.structureType] &&
        structure.hits < structure.hitsMax * repairSheet["other"])
  });
  if (target) {
    creep.memory._target = {
      id: target.id,
      time: Game.time,
      type: "repair"
    };
  }

  return target;
}

function checkRooms(creep) {
  // target cashing (!smart)
  let target;
  if (creep.memory._target && Game.time - creep.memory._target.time <= 50) {
    target = Game.getObjectById(creep.memory._target.id);
    // target is still valid;
    if (!target || !(creep.memory._target.type == "repair" && (repairSheet[target.structureType] &&
          target.hits < repairSheet[target.structureType]) ||
        (!repairSheet[target.structureType] &&
          target.hits < target.hitsMax * repairSheet["other"]))) {
      target = 0;
    }
  }

  if (!target) {
    target = getTargetBuild(creep, creep.room);
  }

  if (!target && creep.room.name != creep.memory.homeroom) {
    target = getTargetBuild(creep, Game.rooms[creep.memory.homeroom]);
  }

  if (!target) {
    // idk why would i need this case but sure
    for (let annexName in Game.rooms[creep.memory.homeroom].memory.annexes) {
      if (creep.room.name != annexName) {
        target = getTargetBuild(creep, Game.rooms[annexName]);
        if (target) {
          break;
        }
      }
    }
  }

  if (!target) {
    target = getTargetRepair(creep, creep.room);
  }

  if (!target && creep.room.name != creep.memory.homeroom) {
    target = getTargetRepair(creep, Game.rooms[creep.memory.homeroom]);
  }

  if (!target) {
    for (let annexName in Game.rooms[creep.memory.homeroom].memory.annexes) {
      if (creep.room.name != annexName) {
        target = getTargetRepair(creep, Game.rooms[annexName]);
        if (target) {
          break;
        }
      }
    }
  }

  return target;
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

      // prob can set it in room memory for different types of rooms
      let repairSheet = {
        [STRUCTURE_RAMPART]: 200000,
        [STRUCTURE_WALL]: 200000,
        other: 1,
      }

      let target;
      if (creep.memory._target && Game.time - creep.memory._target.time <= 50) {
        target = Game.getObjectById(creep.memory._target.id);
        // target is still valid;
        if (!target || !(creep.memory._target.type == "repair" && (repairSheet[target.structureType] &&
              target.hits < repairSheet[target.structureType]) ||
            (!repairSheet[target.structureType] &&
              target.hits < target.hitsMax * repairSheet["other"]))) {
          target = 0;
        }
      }

      target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
      if (target) {
        creep.memory._target = {
          id: target.id,
          time: Game.time,
          type: "build"
        };
      }

      if (!target) {
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
            type: "repair"
          };
        }
      }

      if (target) {
        if (creep.pos.getRangeTo(target) > 3) {
          creep.moveTo(target, {
            reusePath: REUSE_PATH
          });
        } else {
          if (creep.memory._target.type == "build") {
            creep.build(target);
          } else if (creep.memory._target.type == "repair") {
            creep.repair(target);
          }
          // didnt add fail-safe, but i added _target.type for all cases higher
        }
      }
    }
  },

  coolName: "Colletidae ",
  spawn: function(room) {
    let target = _.get(room.memory, ["roles", roleName], 2);
    let real = _.filter(Game.creeps, (creep) => creep.memory.role == roleName && creep.memory.homeroom == room.name).length

    //just summon 1 builder from time to time. Just to keep repairs in check -_-
    if (!(Game.time % 4500 == 0 && real > 0) && (real >= target || room.find(FIND_CONSTRUCTION_SITES).length == 0)) {
      let annexConstructionSites = 0
      for (let annexName in room.memory.annexes) {
        annexConstructionSites = Math.max(annexConstructionSites, Game.rooms[annexName], room.find(FIND_CONSTRUCTION_SITES).length)
      }

      if (!annexConstructionSites)
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

    spawnSettings.postSpawn = function(creepName) {
      console.log("spawned a " + roleName + " named " + creepName + " in " + room.name);
    };

    return spawnSettings;
  },
}

module.exports = roleBuilder;