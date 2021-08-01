Creep.prototype.getSource = function() {
  let source = Game.getObjectById(this.memory.resource_id);
  if (!source) {
    source = this.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
    this.memory.sourceId = source.id;
  }

  return source;
}

Creep.prototype.getSourceData = function() {
  let source = this.getSource();
  let sourceData = _.get(Game.rooms[this.memory.homeroom].memory, ["resourses", source.room.name, "energy", source.id]);

  if (!sourceData) {
    sourceData = findSources(source.room, Game.rooms[this.memory.homeroom], source.id);
  }

  return sourceData;
}

Creep.prototype.harvestSource = function() {
  let source = this.getSource();
  if (this.harvest(source) == ERR_NOT_IN_RANGE) {
    this.moveTo(source, {
      reusePath: REUSE_PATH
    });
  }
}

Creep.prototype.moveToRoom = function(roomName) {
  this.moveTo(new RoomPosition(25, 25, roomName), {
    reusePath: REUSE_PATH
  });
}

Creep.prototype.getEnergyFromStorage = function() {
  let target = this.pos.findClosestByPath(FIND_STRUCTURES, {
    filter: (structure) => {
      return (structure.structureType == STRUCTURE_CONTAINER ||
          structure.structureType == STRUCTURE_STORAGE) &&
        structure.store.getUsedCapacity(RESOURCE_ENERGY) >= this.store.getFreeCapacity(RESOURCE_ENERGY)
    }
  });

  if (!target) {
    return ERR_NOT_FOUND;
  }

  if (!this.pos.isNearTo(target)) {
    this.moveTo(target);
  }

  return this.withdraw(target, RESOURCE_ENERGY);
}

Creep.prototype.getEnergyFromHarvesters = function() {
  let target = this.pos.findClosestByPath(FIND_STRUCTURES, {
    filter: (structure) => {
      return (structure.structureType == STRUCTURE_CONTAINER) &&
        // almost full
        structure.store.getCapacity() * 0.1 > structure.store.getFreeCapacity() &&
        minerContainerIds.includes(structure.id);
    }
  });

  if (!target) {
    target = this.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (structure) => {
        return (structure.structureType == STRUCTURE_CONTAINER) &&
          // any other container that is full enough
          structure.store.getUsedCapacity(RESOURCE_ENERGY) > this.store.getFreeCapacity() &&
          minerContainerIds.includes(structure.id);
      }
    });

    if (!target) {
      return ERR_NOT_FOUND;
    }
  }

  if (!this.pos.isNearTo(target)) {
    this.moveTo(target, {
      reusePath: REUSE_PATH
    });
  }

  return this.withdraw(target, RESOURCE_ENERGY);
}