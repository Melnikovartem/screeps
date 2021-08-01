function findSources(room) {
  if (!room.memory.resourses) {
    room.memory.resourses = {}
  }
  if (!room.memory.resourses[room.name]) {
    let sources = room.find(FIND_SOURCES);

    let spawn = room.find(FIND_MY_STRUCTURES, {
      filter: {
        structureType: STRUCTURE_SPAWN
      }
    })[0];

    _.forEach(sources, function(source) {
      let data = _.get(room.memory, ['resourses', room.name, RESOURCE_ENERGY, source.id]);

      if (data == undefined) {

        data = {
          store_nearby: "", // Id
          route_time: 0, //route to spawner from resource
          last_spawned: Game.time - CREEP_LIFE_TIME, // last time i spawned a harvester,
        };
        _.set(room.memory, ['resourses', room.name, RESOURCE_ENERGY, source.id], data);
      }

      if (spawn) {
        data.route_time = spawn.pos.getTimeForPath(source.pos);
        console.log(data.route_time);
      }

      if (!data.store_nearby) {
        let store = _.filter(source.pos.findInRange(FIND_STRUCTURES, 1),
          (structure) => structure.structureType == STRUCTURE_CONTAINER
        )[0];
        data.store_nearby = store.id;
      }

    });
  }
}

function updateRolesTarget(room) {
  let target = _.get(room.memory, ["roles"]);
  if (!target) {
    room.memory.roles = {
      harvester: 2,
      hauler: 1,
      builder: 1,
      upgrader: 2,
    }
  }
}

var roomDefense = require('room.defense');
var roomSpawning = require('room.spawning');

function roomLoop() {
  _.forEach(Game.rooms, function(room) {

    roomDefense(room);
    roomSpawning(room);

    if (Game.time % 1 == 0) {
      findSources(room);
      updateRolesTarget(room);
    }
  });
}


module.exports = roomLoop;