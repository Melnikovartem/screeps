Creep.prototype.harvestSource = function() {
  var source = this.pos.findClosestByPath(FIND_SOURCES_ACTIVE);

  if(this.harvest(source) == ERR_NOT_IN_RANGE) {
      this.moveTo(source);
  }
}

Creep.prototype.getEnergyFromStorage = function () {
  var storage = this.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: (structure) => {
              return (structure.structureType == STRUCTURE_CONTAINER) &&
                      structure.store.getUsedCapacity(RESOURCE_ENERGY) > creep.store.getFreeCapacity();
          }
  });;
  if(this.withdraw(storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
      this.moveTo(storage);
  }
}
