global.createArmy = function(armyName, roomName) {
  if (!_.get(Memory, ["armies", armyName])) {
    let armyData = {
      target: roomName,
      stationed: roomName,
      roles: {},
      high_alert: 0, // do we need to check room each tick
      replenished: 0, // last time this army was replenished finished
      reuse_path: 5, // how smart do we need to be with our moves
      enenmies: {}
    };
    _.set(Memory, ["armies", armyName], armyData);
  }
}

global.addSolider = function(armyName, role, amount = 1) {
  if (!Object.keys(ROLES).includes(role)) {
    return ERR_NOT_FOUND;
  }

  let army = Memory.armies[armyName];

  if (army) {
    if (army.roles[role]) {
      army.roles[role] += amount;
    } else {
      army.roles[role] = amount;
    }

    if (army.roles[role] <= 0) {
      army.roles[role] = 0;
    }

    army.replenished = 0;
    return army.roles[role];
  } else {
    return ERR_NOT_FOUND;
  }
}

global.roomBalance = function(roomName) {
  console.log("role balance in room " + roomName + "");

  _.forEach(Object.keys(ROLES), function(roleName) {
    let real = _.filter(Game.creeps, (creep) => creep.memory.role == roleName && creep.memory.homeroom == roomName).length
    console.log(roleName + ": " + real);
  });
}

global.annexation = function(myRoomName, targetRoomName, reservation = 1) {
  let myRoom = Game.rooms[myRoomName];
  let targetRoom = Game.rooms[targetRoomName];

  if (!myRoom || !myRoom.controller.my || !targetRoom) {
    return;
  }

  if (!myRoom.memory.annexes) {
    myRoom.memory.annexes = {}
  }

  // think of tags later
  myRoom.memory.annexes[targetRoomName] = {}

  if (reservation) {
    myRoom.memory.annexes[targetRoomName].reservation = {
      route_time: 75, //route from spawner to contoller //for now just a random number
      last_spawned: Game.time - CREEP_LIFE_TIME, // last time i spawned a claimer,
    }
  }

  return OK;
}

global.findSources = function(checkRoom, parentRoom = 0) {
  if (!parentRoom) {
    parentRoom = checkRoom;
  }

  if (!parentRoom.memory.resourses) {
    parentRoom.memory.resourses = {}
  }

  let sources = checkRoom.find(FIND_SOURCES);

  _.forEach(sources, function(source) {
    let data = _.get(parentRoom.memory, ['resourses', checkRoom.name, RESOURCE_ENERGY, source.id]);

    if (data == undefined) {
      data = {
        store_nearby: "", // Id
        last_spawned: Game.time - CREEP_LIFE_TIME, // last time i spawned a harvester,
      };
      _.set(parentRoom.memory, ['resourses', checkRoom.name, RESOURCE_ENERGY, source.id], data);
    }

    if (!data.store_nearby || !Game.getObjectById(data.store_nearby)) {
      data.store_nearby = 0;
      let store = _.filter(source.pos.findInRange(FIND_STRUCTURES, 1),
        (structure) => structure.structureType == STRUCTURE_CONTAINER
      )[0];
      if (store) {
        data.store_nearby = store.id;
      }
    }

    if (!data.last_spawned) {
      let harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == "harvester" && creep.memory.resource_id == source.id);
      if (harvesters.length) {
        data.last_spawned = harvesters[harvesters.length - 1].memory.born;
      } else {
        data.last_spawned = Game.time - CREEP_LIFE_TIME;
      }
    }
  });
}