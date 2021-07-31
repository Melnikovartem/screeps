require('constants')

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

function roomSpawning(room) {
  let spawns = room.find(FIND_MY_STRUCTURES, {
    filter: { structureType: STRUCTURE_SPAWN }
  });
  spawns = _.filter(spawns, (structure) => structure.spawning == null);

  let i = 0;

  if (Game.time % 200 == 0) {
    console.log("Role balance in room " + room.name + ":");
  }


  _.forEach(Object.keys(ROLES), function(roleName) {

    if (!spawns[i])
      return

    let spawnSettings = ROLES[roleName].spawn(room);
    if (spawnSettings) {
      let creepName = ROLES[roleName].coolName + '' + getRandomInt(10000);
      let ans = spawns[i].spawnCreep(spawnSettings.bodyParts,  creepName, { memory: spawnSettings.memory });
      if (ans == OK) {
        console.log('spawned ' + roleName);
        i += 1;
      }
    }
  });
}


module.exports = roomSpawning;
