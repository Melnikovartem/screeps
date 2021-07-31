let roleUpgrader  = {
  run: function(creep) {
    if(creep.memory.hauling && creep.store[RESOURCE_ENERGY] == 0) {
        creep.memory.hauling = false;
        creep.say('🔄');
    }

    if(!creep.memory.hauling) {
      let ans = creep.getEnergyFromContainer();
      if(ans == OK) {
          creep.memory.hauling = true;
          creep.say('➡');
      }
    }

    let target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_EXTENSION ||
                            structure.structureType == STRUCTURE_SPAWN)  &&
                            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
      });

      if(!target) {
        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_TOWER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > structure.store.getCapacity(RESOURCE_ENERGY) * 0.1) ||
                               (storageContainerIds.includes(structure.id) && structure.store.getFreeCapacity(RESOURCE_ENERGY) >= creep.store[RESOURCE_ENERGY])
                    }
          });
      }

      if(!target) {
        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_TOWER || storageContainerIds.includes(structure.id))
                    }
          });
      }

      if (creep.memory.hauling) {
        if(!creep.pos.isNearTo(target)) {
          creep.moveTo(target, {reusePath: RESUSE_PATH});
        }
        creep.transfer(target, RESOURCE_ENERGY);
      }
  },

  coolName: "Bumblebee ",
  spawn: function(room) {
    let roleName = "hauler";
    let target = _.get(room.memory, ["roles", roleName], 2);
    let real   = _.filter(Game.creeps, (creep) => creep.memory.role == roleName && creep.memory.homeroom == room.name).length

    if (Game.time % OUTPUT_TICK == 0) {
      console.log(roleName + ": " + real + "/" + target);
    }

    if (real >= target) {
      return
    }

    let spawnSettings = { bodyParts: [], memory: {} }
    let roomEnergy = 300;
    if (real < target/2 || target == 1) {
      roomEnergy = room.energyAvailable;
    } else {
      roomEnergy = room.energyCapacityAvailable;
    }

    let segment = [CARRY,CARRY,MOVE];
    let segmentCost = _.sum(segment, s => BODYPART_COST[s]);

    let maxSegment = Math.floor( roomEnergy / segmentCost);

    _.forEach(segment, function(s) {
      _.times(maxSegment, () => spawnSettings.bodyParts.push(s))
    });

    spawnSettings.memory  =  { role: roleName, born: Game.time, homeroom: room.name, hauling: false };

    return spawnSettings;
  },
}

module.exports = roleUpgrader;
