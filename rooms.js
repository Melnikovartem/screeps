function findSources(room) {
  if (!room.memory.resourses) {
    room.memory.resourses = {}
  }
  if (!room.memory.resourses[room.name]) {
    let sources = room.find(FIND_SOURCES);

    _.forEach(sources, function(source) {
      let data = _.get(room.memory, ['resourses', room.name, RESOURCE_ENERGY, source.id]);

      if (data == undefined) {
        _.set(room.memory, ['resourses', room.name, RESOURCE_ENERGY, source.id], {});
      }
    })
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

    if (Game.time % 500 == 0) {
      findSources(room);
      updateRolesTarget(room);
    }
  });
}


module.exports = roomLoop;