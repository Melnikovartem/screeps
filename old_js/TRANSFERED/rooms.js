// here nothing important (getting rid of roles) so
// TRANSFERED

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

function tryWrapperRoomLogic(func, room, message = "something fucked up in room logic\n") {
  try {
    func(room);
  } catch (error) {
    console.log(message, room);
  }
}

function roomLoop() {
  _.forEach(Game.rooms, function(room) {
    if (room.controller && room.controller.my) {
      tryWrapperRoomLogic(roomDefense, room);
      tryWrapperRoomLogic(roomSpawning, room);

      if (Game.time % 500 == 0 && room.controller.my) {
        // this one are stable? caue working with room.controller.my
        findSources(room);
        updateRolesTarget(room);
        _.forEach(room.memory.annexes, function(annexData, annexName) {
          // can see anex with code
          if (Game.rooms[annexName]) {
            findSources(Game.rooms[annexName], room);
          }
        });
      }
    }
  });
}


module.exports = roomLoop;
