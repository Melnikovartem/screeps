let roleHarvester = {
  run: function(creep) {
    if (creep.store[RESOURCE_ENERGY] == 0) {
      creep.memory.fflush = false;
    }
    if(creep.store.getFreeCapacity() > 0 && !creep.memory.fflush) {
          creep.harvestSource();
      }

    let structuresNear = creep.pos.findInRange(FIND_STRUCTURES, 1);
    let target = structuresNear.filter(
      (structure) => (minerContainerIds.includes(structure.id)) && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    )[0];

    if (creep.room.energyCapacityAvailable * 0.5 > creep.room.energyAvailable ) {
        if (creep.store.getFreeCapacity() == 0 && !creep.memory.fflush){
          creep.memory.fflush = true;
        }
        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_EXTENSION ||
                            structure.structureType == STRUCTURE_SPAWN) &&
                            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
        });
      }

    if (target) {
      if (creep.pos.isNearTo(target) && creep.store[RESOURCE_ENERGY] >= 25) {
          creep.transfer(target, RESOURCE_ENERGY);
      } else if (creep.memory.fflush) {
        if(creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
        }
      }
    } else {
      if (creep.store.getFreeCapacity() > 0) {
        creep.memory.fflush = false;
      }
    }
  },
  coolName: "Andrena ",
  spawn: function(room) {
    let roleName = "harvester";
    let target = _.get(room.memory, ["roles", roleName], 2);
    let real   = _.filter(Game.creeps, (creep) => creep.memory.role == roleName && creep.memory.homeroom == room.name).length

    if (Game.time % OUTPUT_TICK == 0) {
      console.log(roleName + ": " + real + "/" + target);
    }

    if (real >= target) {
      return
    }

    let spawnSettings = { bodyParts: [WORK,CARRY,MOVE], memory: {} }
    let roomEnergy = 300;
    if (real < target/3 || real == 0) {
      roomEnergy = room.energyAvailable;
    } else {
      roomEnergy = room.energyCapacityAvailable;
    }

    let fixedCosts = _.sum(spawnSettings.bodyParts, s => BODYPART_COST[s]);

    let segment = [WORK,WORK,MOVE];
    let segmentCost = _.sum(segment, s => BODYPART_COST[s]);

    let maxSegment = Math.min(2, Math.floor( (roomEnergy - fixedCosts) / segmentCost));

    _.forEach(segment, function(s) {
      _.times(maxSegment, () => spawnSettings.bodyParts.push(s))
    });

    spawnSettings.memory  =  { role: roleName, born: Game.time, homeroom: room.name, fflush: false };

    return spawnSettings;
  },
}


module.exports = roleHarvester;
