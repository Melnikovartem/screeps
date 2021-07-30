function roleUpgrader(creep) {
  if(creep.memory.upgrading && creep.store[RESOURCE_ENERGY] == 0) {
      creep.memory.upgrading = false;
      creep.say('🔄');
  }

  if(!creep.memory.upgrading) {
    if(creep.getEnergyFromStorage(creep)) {
        creep.memory.upgrading = true;
        creep.say('⚡');
    }
  }

  if(creep.memory.upgrading) {
    if (!creep.pos.isNearTo(creep.room.controller)) {
      creep.moveTo(creep.room.controller);
    } else {
      creep.upgradeController(creep.room.controller)
    }
  }
}

module.exports = roleUpgrader;
