function findClosestByRange(list_of_targets, pos) {
  if (list_of_targets)
    return _.sortBy(list_of_targets, s => pos.getRangeTo(s))[0]
}

function harvestClosesSource(creep) {
  var source = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);

  if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
      creep.moveTo(source); //, {visualizePathStyle: {stroke: '#ffffff'}});
  }
}

var roleFunctions = {

  getEnergyFromStorage: function(creep) {
    var source = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);

    if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
        creep.moveTo(source); //, {visualizePathStyle: {stroke: '#ffffff'}});
    }
  },

  harvestClosesSource,

  findClosestByRange,
};


module.exports = roleFunctions;
