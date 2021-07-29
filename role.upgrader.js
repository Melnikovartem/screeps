function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

var roleUpgrader = {

    /** @param {Creep} creep **/
    run: function(creep) {

        if(creep.memory.upgrading && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.upgrading = false;
            creep.say('🔄 harvest');
	    }
	    if(!creep.memory.upgrading && creep.store.getFreeCapacity() == 0) {
	        creep.memory.upgrading = true;
	        creep.say('⚡ upgrade');
	    }

	    if(creep.memory.upgrading) {
            if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller); //, {visualizePathStyle: {stroke: '#ffffff'}});
            }
        }
        else {
            var sources = creep.room.find(FIND_SOURCES);
            var source = sources[getRandomInt(sources.length)];

            if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
                creep.moveTo(source); //, {visualizePathStyle: {stroke: '#ffffff'}});
            }
        }
	}
};

module.exports = roleUpgrader;
