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


//if looking to check only one source we put it in sourceId
global.findSources = function(checkRoom, parentRoom = 0, sourceId = 0) {
  if (!parentRoom) {
    parentRoom = checkRoom;
  }

  if (!parentRoom.memory.resourses) {
    parentRoom.memory.resourses = {}
  }

  let sources = checkRoom.find(FIND_SOURCES, {
    filter: (source) => !sourceId || source.id == sourceId
  });

  let spawn = parentRoom.find(FIND_MY_STRUCTURES, {
    filter: {
      structureType: STRUCTURE_SPAWN
    }
  })[0];

  _.forEach(sources, function(source) {
    let data = _.get(parentRoom.memory, ['resourses', checkRoom.name, RESOURCE_ENERGY, source.id]);

    if (data == undefined) {
      data = {
        store_nearby: "", // Id
        route_time: 0, //route to spawner from resource
        last_spawned: Game.time - CREEP_LIFE_TIME, // last time i spawned a harvester,
        harvesters: [],
        haulers: [],
      };
      _.set(parentRoom.memory, ['resourses', checkRoom.name, RESOURCE_ENERGY, source.id], data);
    }

    data.harvesters = [];
    data.haulers = [];

    let harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == "harvester" && creep.memory.resource_id == source.id);
    if (harvesters.length) {
      _.forEach(harvesters, (creep) => data.harvesters.push(creep.id))
      data.last_spawned = harvesters[harvesters.length - 1].memory.born;
    } else {
      data.last_spawned = data.last_spawned = Game.time - CREEP_LIFE_TIME;
    }

    let haulers = _.filter(Game.creeps, (creep) => creep.memory.role == "hauler" && creep.memory.resource_id == source.id);
    if (haulers.length) {
      _.forEach(haulers, (creep) => data.haulers.push(creep.id));
    }

    if (spawn) {
      data.route_time = spawn.pos.getTimeForPath(source.pos);
    }

    if (!data.store_nearby || !Game.getObjectById(data.store_nearby)) {
      let store = _.filter(source.pos.findInRange(FIND_STRUCTURES, 1),
        (structure) => structure.structureType == STRUCTURE_CONTAINER
      )[0];
      if (store) {
        data.store_nearby = store.id;
      }
    }

    if (sourceId == source.id) {
      return data
    }
  });
}