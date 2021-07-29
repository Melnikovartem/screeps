function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

function findClosestByRange(list_of_targets, pos) {
  if (list_of_targets)
    return _.sortBy(list_of_targets, s => pos.getRangeTo(s))[0]
}

var roleFunctions = {
  harvestClosesSource: function(creep) {
    var source = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);

    if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
        creep.moveTo(source); //, {visualizePathStyle: {stroke: '#ffffff'}});
    }
  },

  getEnergyFromStorage: function(creep) {
    //TODO
  },

  findClosestByRange
};


module.exports = roleFunctions;
