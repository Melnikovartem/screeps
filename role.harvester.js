let roleHarvester = {
  run: function(creep) {
    if (creep.store.getFreeCapacity() > 0 && !creep.memory.fflush) {
      creep.harvestSource();
    }

    if (creep.memory.fflush || creep.store.getUsedCapacity(RESOURCE_ENERGY) >= 50) {
      let target = _.filter(creep.pos.findInRange(FIND_MY_CREEPS, 1),
        (creepIter) => creepIter.memory.role == "hauler" && creepIter.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      )[0];

      if (!target) {
        target = _.filter(creep.pos.findInRange(FIND_STRUCTURES, 1),
          (structure) => structure.structureType == STRUCTURE_CONTAINER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        )[0];
      }

      // fail-safe if haulers are dead
      if (creep.room.energyCapacityAvailable * 0.5 > creep.room.energyAvailable) {
        if (_.filter(Game.creeps, (creepIter) => creepIter.memory.role == "hauler" && creepIter.memory.homeroom == creep.room.name).length == 0) {
          if (creep.store.getFreeCapacity() == 0 && !creep.memory.fflush) {
            creep.memory.fflush = true;
          }
          target = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
            filter: (structure) => {
              return (structure.structureType == STRUCTURE_EXTENSION ||
                  structure.structureType == STRUCTURE_SPAWN) &&
                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
          });
        }
      }

      if (!target) {
        //fail safe if somth wrong with targets :/
        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: (structure) => {
            return (structure.structureType == STRUCTURE_EXTENSION ||
                structure.structureType == STRUCTURE_SPAWN) &&
              structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
          }
        });
      }


      if (target) {
        if (creep.pos.isNearTo(target)) {
          creep.transfer(target, RESOURCE_ENERGY);
          if (creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
            creep.memory.fflush = false;
          }
        } else if (creep.memory.fflush) {
          creep.moveTo(target, {
            reusePath: REUSE_PATH
          });
        }
      }
    }
  },

  coolName: "Andrena ",
  spawn: function(room) {
    let roleName = "harvester";

    if (room.memory.resourses) {
      for (let roomName in room.memory.resourses) {
        for (let sourceId in room.memory.resourses[roomName].energy) {
          let source = room.memory.resourses[roomName].energy[sourceId];

          if (Game.time + source.route_time >= source.last_spawned + CREEP_LIFE_TIME) {

            let spawnSettings = {}

            let roomEnergy = room.energyAvailable;


            spawnSettings.bodyParts = [WORK, CARRY, MOVE]

            let fixedCosts = _.sum(spawnSettings.bodyParts, s => BODYPART_COST[s]);

            let segment = [WORK, WORK, MOVE];
            let segmentCost = _.sum(segment, s => BODYPART_COST[s]);

            let maxSegment = Math.min(2, Math.floor((roomEnergy - fixedCosts) / segmentCost));

            let sumCost = fixedCosts + segmentCost * maxSegment

            _.times(maxSegment, function() {
              _.forEach(segment, (s) => spawnSettings.bodyParts.push(s))
            });

            if (source.route_time && !source.store_nearby) {
              segment = [CARRY, CARRY, MOVE];
              maxSegment = Math.min(Math.ceil(source.route_time * 2 / 50), Math.floor((roomEnergy - sumCost) / segmentCost));

              _.times(maxSegment, function() {
                _.forEach(segment, (s) => spawnSettings.bodyParts.push(s))
              });
            }

            spawnSettings.memory = {
              role: roleName,
              born: Game.time,
              homeroom: room.name,
              fflush: false,
              resource_id: sourceId
            };

            spawnSettings.postSpawn = function() {
              source.last_spawned = Game.time;
              console.log("spawned " + roleName + " in " + room.name + " for " + sourceId + "  located in " + roomName);
            };


            return spawnSettings;
          }
        }
      }
    }
  },
}

module.exports = roleHarvester;