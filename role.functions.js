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
  //reusing target as reusing paths
  let target;
  if (this.memory.target && Game.time - this.memory.target.time >= 100) {
    target = Game.getObjectById(this.memory.target.id);
    // target is still valid;
    if (!(target.store.getUsedCapacity(RESOURCE_ENERGY) >= target.store.getCapacity(RESOURCE_ENERGY) * 0.5 ||
        target.store.getUsedCapacity(RESOURCE_ENERGY) >= this.store.getFreeCapacity(RESOURCE_ENERGY))) {
      target = 0;
    }
  }

  if (!target) {
    let targets = [];
    let room = Game.rooms[this.memory.homeroom]


    if (!room.memory.resourses) {
      if (this.room.name != this.memory.homeroom) {
        findSources(room, creep.room);
      }
      findSources(room, this.memory.homeroom);
    }


    for (let roomName in room.memory.resourses) {
      for (let sourceId in room.memory.resourses[roomName].energy) {
        let source = room.memory.resourses[roomName].energy[sourceId];
        let storeNearby = Game.getObjectById(source.store_nearby);

        if (storeNearby) {
          // Full over half or a lot of energy inside
          if (storeNearby.store.getUsedCapacity(RESOURCE_ENERGY) >= storeNearby.store.getCapacity(RESOURCE_ENERGY) * 0.5 ||
            storeNearby.store.getUsedCapacity(RESOURCE_ENERGY) >= this.store.getFreeCapacity(RESOURCE_ENERGY)) {
            targets.push(storeNearby);
          }
        } else {
          _.forEach(source.harvesters,
            // Full over half or a lot of energy inside
            (creepId) => {
              let creep = Game.getObjectById(creepId);
              if (creep && (creep.store.getUsedCapacity(RESOURCE_ENERGY) >= creep.store.getCapacity(RESOURCE_ENERGY) * 0.5 ||
                  creep.store.getUsedCapacity(RESOURCE_ENERGY) >= this.store.getFreeCapacity(RESOURCE_ENERGY))) {
                targets.push(creep);
              }
            });
        }
      }
    }

    // sort by empty size, then by max size
    // need to think what to do with distance ?
    targets.sort((a, b) => {
      if (a.store.getFreeCapacity(RESOURCE_ENERGY) == b.store.getFreeCapacity(RESOURCE_ENERGY)) {
        return b.store.getCapacity(RESOURCE_ENERGY) - a.store.getCapacity(RESOURCE_ENERGY);
      }
      return a.store.getFreeCapacity(RESOURCE_ENERGY) - b.store.getFreeCapacity(RESOURCE_ENERGY);
    });

    target = targets[0];
  }

  // update target info
  this.memory.target = {
    id: target.id,
    time: Game.time,
  };

  if (!this.pos.isNearTo(target)) {
    this.moveTo(target, {
      reusePath: REUSE_PATH
    });
  }

  let ans; // 0 is OK

  if (target instanceof Creep) {
    ans = target.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && this.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
  } else {
    ans = this.withdraw(target, RESOURCE_ENERGY);
  }

  if (ans == OK) {
    this.memory.target = 0;
  }

  return ans;
}