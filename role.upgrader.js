var roleUpgrader = {
  
    run: function(creep) {

      if(creep.memory.upgrading && creep.store[RESOURCE_ENERGY] == 0) {
          creep.memory.upgrading = false;
          creep.say('🔄');
	    }

	    if(!creep.memory.upgrading) {
        creep.getEnergyFromStorage(creep);
      }


	    if(!creep.memory.upgrading && creep.store.getFreeCapacity() == 0) {
	        creep.memory.upgrading = true;
	        creep.say('⚡');
	    }

      if(creep.memory.upgrading && creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
          creep.moveTo(creep.room.controller); //, {visualizePathStyle: {stroke: '#ffffff'}});
      }
	}
};

module.exports = roleUpgrader;
