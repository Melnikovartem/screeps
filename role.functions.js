function findClosestByRange(list_of_targets, pos) {
  if (list_of_targets)
    return _.sortBy(list_of_targets, s => pos.getRangeTo(s))[0]
}

function harvestClosesSource(creep) {
  var source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);

  if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
      creep.moveTo(source); //, {visualizePathStyle: {stroke: '#ffffff'}});
  }
}

var roleFunctions = {

  getEnergyFromStorage: function(creep) {
    var storage = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_CONTAINER) &&
                        structure.store.getUsedCapacity(RESOURCE_ENERGY) > creep.store.getFreeCapacity();
            }
    });;
    if (storage) {
      if(creep.withdraw(storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
          creep.moveTo(storage);
      }
    } else {
      harvestClosesSource(creep)
    }
  },

  harvestClosesSource,

  findClosestByRange,
};


module.exports = roleFunctions;
