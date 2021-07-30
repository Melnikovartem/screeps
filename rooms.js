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

function roomLoop() {
    _.forEach(Game.rooms, function(room) {

      
      if (Game.time % 500 == 0) {
        findSources(room);
      }
    });
}


module.exports = roomLoop;
