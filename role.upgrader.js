let roleUpgrader  = {
  run: function(creep) {
    if(creep.memory.upgrading && creep.store[RESOURCE_ENERGY] == 0) {
        creep.memory.upgrading = false;
        creep.say('🔄');
    }

    if(!creep.memory.upgrading) {
      if(creep.getEnergyFromStorage() == OK) {
          creep.memory.upgrading = true;
          creep.say('⚡');
      }
    }

    if(creep.memory.upgrading) {
      if (creep.pos.getRangeTo(creep.room.controller) > 3) {
        creep.moveTo(creep.room.controller);
      } else {
        creep.upgradeController(creep.room.controller)
      }
    }
  },

  bodyParts: [WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE],
  coolName: "Honey bee ",
}

module.exports = roleUpgrader;
