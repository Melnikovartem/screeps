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
  if (this.pos.isNearTo(source)) {
    this.harvest(source)
  } else {
    this.moveTo(source, {
      reusePath: REUSE_PATH
    });
  }

  if (this.store.getFreeCapacity(RESOURCE_ENERGY) == 0) {
    return OK;
  }
}

Creep.prototype.moveToRoom = function(roomName) {
  return this.moveTo(new RoomPosition(25, 25, roomName), {
    reusePath: REUSE_PATH,
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
    this.memory._sucker_target = null;
  }

  return ans;
}

Creep.prototype.getEnergyFromStorage = function() {
  // hey reusing is a good idea to save CPU
  let target;
  if (this.memory._sucker_target && Game.time - this.memory._sucker_target.time <= 100) {
    target = Game.getObjectById(this.memory._sucker_target.id);
    // target is still valid; need to fill the creep storage as fast as i can
    if (!target || !(target.store.getUsedCapacity(RESOURCE_ENERGY) >= this.store.getFreeCapacity(RESOURCE_ENERGY))) {
      target = null;
    }
  }

  if (!target) {
    target = this.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (structure) => (structure.structureType == STRUCTURE_CONTAINER ||
          structure.structureType == STRUCTURE_STORAGE) &&
        structure.store.getUsedCapacity(RESOURCE_ENERGY) >= this.store.getFreeCapacity(RESOURCE_ENERGY)
    });
  }

  if (!target && this.room.name != this.memory.homeroom) {
    // get your energy home if you cant find it in this one
    this.moveToRoom(this.memory.homeroom);
    return ERR_NOT_FOUND;
  }

  return this.suckFromTarget(target);
}

Creep.prototype.getEnergyFromHarvesters = function() {
  //reusing target as reusing paths
  let target;
  if (this.memory._sucker_target && Game.time - this.memory._sucker_target.time <= 100) {
    target = Game.getObjectById(this.memory._sucker_target.id);
    // target is still valid; need to ceep the container storage empty
    if (!target || !(target.store.getUsedCapacity(RESOURCE_ENERGY) >= 200 && target.structureType == STRUCTURE_CONTAINER)) {
      target = null;
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

        let isTargeted = source._is_targeted && Game.getObjectById(source._is_targeted);
        if (isTargeted) {
          isTargeted = isTargeted.memory._sucker_target && isTargeted.memory._sucker_target.id == source.store_nearby;
        }

        if (!isTargeted && source._is_targeted || source._is_targeted == this.id) {
          isTargeted = null;
          source._is_targeted = null;
        }

        if (storeNearby && !isTargeted) {
          // Just PUSH that bad boy in
          if (storeNearby.store.getUsedCapacity(RESOURCE_ENERGY) >= 200) {
            targets.push({
              sourceId: sourceId,
              storeId: source.store_nearby,
              freeCapacity: storeNearby.store.getFreeCapacity(RESOURCE_ENERGY),
              capacity: storeNearby.store.getCapacity(RESOURCE_ENERGY),
            });
          }
        }
      }
    }

    if (targets.length) {
      // sort by empty size, then by max size
      // need to think what to do with distance ?
      targets.sort((a, b) => {
        if (a.freeCapacity == b.freeCapacity) {
          return b.capacity - a.capacity;
        }
        return a.freeCapacity - b.freeCapacity;
      });

      target = Game.getObjectById(targets[0].storeId);

      Game.rooms[this.memory.homeroom].memory.resourses[target.room.name].energy[targets[0].sourceId]._is_targeted = this.id;

      console.log(this.name, "targeted", targets[0].storeId);
    }
  }

  return this.suckFromTarget(target);
}