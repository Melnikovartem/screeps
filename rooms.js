function updateRolesTarget(room) {
  let target = _.get(room.memory, ["roles"]);
  if (!target) {
    room.memory.roles = {
      hauler: 1,
      builder: 1,
      upgrader: 1,
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