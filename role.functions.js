Creep.prototype.findSource = function() {
  var source = this.pos.findClosestByPath(FIND_SOURCES_ACTIVE);

  if(this.harvest(source) == ERR_NOT_IN_RANGE) {
      this.moveTo(source);
  }
}

Creep.prototype.harvestSource = function() {
  var source = this.pos.findClosestByPath(FIND_SOURCES_ACTIVE);

  if(this.harvest(source) == ERR_NOT_IN_RANGE) {
      this.moveTo(source);
  }
}

Creep.prototype.moveToRoom = function(roomName) {
  this.moveTo(new RoomPosition(25, 25, roomName));
}

Creep.prototype.getEnergyFromStorage = function() {
  let target = this.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: (structure) => {
              return (structure.structureType == STRUCTURE_CONTAINER) &&
                      structure.store.getUsedCapacity(RESOURCE_ENERGY) > this.store.getFreeCapacity() &&
                      storageContainerIds.includes(structure.id);
          }
  });
  if (!target) {
    target = this.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_CONTAINER) &&
                        structure.store.getUsedCapacity(RESOURCE_ENERGY) > this.store.getFreeCapacity()
            }
    });
    if (!target) {
      return ERR_NOT_FOUND;
    }
  }

  if(!this.pos.isNearTo(target)) {
      this.moveTo(target);
  }

  return this.withdraw(target, RESOURCE_ENERGY);
}

Creep.prototype.getEnergyFromContainer = function() {
  let target = this.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: (structure) => {
              return (structure.structureType == STRUCTURE_CONTAINER) &&
                      structure.store.getFreeCapacity() < structure.store.getCapacity() * 0.1  &&
                      minerContainerIds.includes(structure.id);
          }
  });

  if (!target) {
    target = this.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_CONTAINER) &&
                        structure.store.getUsedCapacity(RESOURCE_ENERGY) > this.store.getFreeCapacity() &&
                        minerContainerIds.includes(structure.id);
            }
    });

    if (!target) {
      return ERR_NOT_FOUND;
    }
  }

  if(!this.pos.isNearTo(target)) {
      this.moveTo(target);
  }

  return this.withdraw(target, RESOURCE_ENERGY);
}
