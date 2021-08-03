Creep.prototype.getSource = function() {
  let source = Game.getObjectById(this.memory.resource_id);
  if (!source) {
    source = this.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
    this.memory.resource_id = source.id;

    let room = Game.rooms[this.memory.homeroom]
    findSources(room, room, source.id);
  }

  return source;
}

Creep.prototype.getSourceData = function() {
  let source = this.getSource();
  let sourceData = _.get(Game.rooms[this.memory.homeroom].memory, ["resourses", source.room.name, "energy", source.id]);

  if (!sourceData) {
    findSources(source.room, Game.rooms[this.memory.homeroom]);
    sourceData = {}; // next tick this will not be
  }

  return sourceData;
}

Creep.prototype.harvestSource = function() {
  let source = this.getSource();
  if (!this.pos.isNearTo(source)) {
    this.moveTo(source, {
      reusePath: REUSE_PATH
    });
  } else {
    this.harvest(source)
  }

  if (this.store.getFreeCapacity(RESOURCE_ENERGY) == 0) {
    return OK;
  }
}

Creep.prototype.moveToRoom = function(roomName) {
  return this.moveTo(new RoomPosition(25, 25, roomName), {
    reusePath: REUSE_PATH
  });
}

Creep.prototype.suckFromTarget = function(target) {

  // fail-safe for early game
  if (!target && Game.rooms[this.memory.homeroom].controller.level < 4) {
    return this.harvestSource();
  }

  if (!target) {
    return ERR_NOT_FOUND;
  }

  // update target info
  this.memory._sucker_target = {
    id: target.id,
    time: Game.time,
  };

  let ans = ERR_NOT_IN_RANGE; // 0 is OK
  if (!this.pos.isNearTo(target)) {
    this.moveTo(target, {
      reusePath: REUSE_PATH
    });
  } else {
    ans = this.withdraw(target, RESOURCE_ENERGY);

    if (ans == ERR_FULL) {
      ans = OK;
    }
  }

  if (ans == OK) {
    this.memory._sucker_target = 0;
  }

  return ans;
}

Creep.prototype.getEnergyFromStorage = function() {
  // hey reusing is a good idea to save CPU
  let target;
  if (this.memory._sucker_target && Game.time - this.memory._sucker_target.time <= 100) {
    target = Game.getObjectById(this.memory._sucker_target.id);
    // target is still valid;
    if (!target || !(target.store.getUsedCapacity(RESOURCE_ENERGY) >= this.store.getFreeCapacity(RESOURCE_ENERGY))) {
      target = 0;
    }
  }

  if (!target) {
    target = this.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (structure) => (structure.structureType == STRUCTURE_CONTAINER ||
          structure.structureType == STRUCTURE_STORAGE) &&
        structure.store.getUsedCapacity(RESOURCE_ENERGY) >= this.store.getFreeCapacity(RESOURCE_ENERGY)
    });
  }

  if (!target) {
    if (this.room.name != this.memory.homeroom) {
      // get your energy home if you cant find it here
      this.moveToRoom(this.memory.homeroom);
      return ERR_NOT_FOUND;
    }
  }

  return this.suckFromTarget(target);
}

Creep.prototype.getEnergyFromHarvesters = function() {
  //reusing target as reusing paths
  let target;
  if (this.memory._sucker_target && Game.time - this.memory._sucker_target.time <= 100) {
    target = Game.getObjectById(this.memory._sucker_target.id);
    // target is still valid;
    if (!target || !(target.store.getUsedCapacity(RESOURCE_ENERGY) >= target.store.getCapacity(RESOURCE_ENERGY) * 0.5 ||
        target.store.getUsedCapacity(RESOURCE_ENERGY) >= this.store.getFreeCapacity(RESOURCE_ENERGY)) || this.store.getFreeCapacity(RESOURCE_ENERGY) == 0) {
      target = 0;
    }
  }

  if (!target) {
    let targets = [];
    let room = Game.rooms[this.memory.homeroom];


    if (!room.memory.resourses) {
      if (this.room.name != this.memory.homeroom) {
        findSources(room, this.room);
      }
      findSources(room, room);
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

  return this.suckFromTarget(target);
}