let roleName = "harvester";

let roleHarvester = {
  run: function(creep) {
    let sourceData = creep.getSourceData();

    if (creep.store.getFreeCapacity() > 0) {
      creep.harvestSource();
    }

    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) >= 50) {
      //check if harvestContainer

      //check if haulers are nearby
      let target = _.filter(creep.pos.findInRange(FIND_MY_CREEPS, 1),
        (creepIter) => creepIter.memory.role == "hauler" && creepIter.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      )[0];

      if (!target) {
        target = _.filter(creep.pos.findInRange(FIND_STRUCTURES, 1),
          (structure) => structure.structureType == STRUCTURE_CONTAINER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        )[0];
      }

      // fail-safe if haulers are dead?
      //made it very elaborate to stop from mis-fire
      if (creep.room.controller.my) {
        if (creep.room.energyCapacityAvailable * 0.5 > creep.room.energyAvailable) {
          if (creep.room.find(FIND_MY_CREEPS, {
              filter: (creepIter) => creepIter.memory.role == "hauler" && !creep.memory.target_harvester && creepIter.memory.homeroom == creep.room.name
            }).length == 0) {
            let spawnsActive = _.filter(creep.room.find(FIND_MY_STRUCTURES, {
              filter: {
                structureType: STRUCTURE_SPAWN
              }
            }), (structure) => structure.spawning != null);
            if (spawnsActive.length == 0) {
              console.log("here");
              target = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                filter: (structure) => {
                  return (structure.structureType == STRUCTURE_EXTENSION ||
                      structure.structureType == STRUCTURE_SPAWN) &&
                    structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
              });
            }
          }
        }
      }

      if (creep.pos.isNearTo(target)) {
        creep.transfer(target, RESOURCE_ENERGY);
      } else {
        creep.moveTo(target);
      }
    }
  },

  coolName: "Andrena ",
  spawn: function(room) {

    if (room.memory.resourses) {
      for (let roomName in room.memory.resourses) {
        for (let sourceId in room.memory.resourses[roomName].energy) {
          let source = room.memory.resourses[roomName].energy[sourceId];
          if (Game.time + source.route_time >= source.last_spawned + CREEP_LIFE_TIME || source.harvesters.length == 0) {

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