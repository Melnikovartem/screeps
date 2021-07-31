Creep.prototype.harvestSource = function() {
  var source = this.pos.findClosestByPath(FIND_SOURCES_ACTIVE);

  if(this.harvest(source) == ERR_NOT_IN_RANGE) {
      this.moveTo(source);
  }
}

Creep.prototype.getEnergyFromStorage = function() {
  var target = this.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: (structure) => {
              return (structure.structureType == STRUCTURE_CONTAINER) &&
                      structure.store.getUsedCapacity(RESOURCE_ENERGY) > this.store.getFreeCapacity() &&
                      storageContainerIds.includes(structure.id);
          }
  });
  if (!target) {
    var target = this.pos.findClosestByPath(FIND_STRUCTURES, {
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
  var target = this.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: (structure) => {
              return (structure.structureType == STRUCTURE_CONTAINER) &&
                      structure.store.getUsedCapacity(RESOURCE_ENERGY) > this.store.getFreeCapacity() &&
                      minerContainerIds.includes(structure.id);;
          }
  });
  if (!target) {
    return ERR_NOT_FOUND;
  }

  if(!this.pos.isNearTo(target)) {
      this.moveTo(target);
  }

  return this.withdraw(target, RESOURCE_ENERGY);
}
