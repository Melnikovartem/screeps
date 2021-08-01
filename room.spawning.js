function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

function roomSpawning(room) {
  let spawns = room.find(FIND_MY_STRUCTURES, {
    filter: {
      structureType: STRUCTURE_SPAWN
    }
  });
  spawns = _.filter(spawns, (structure) => structure.spawning == null);

  let i = 0;

  for (let j in Object.keys(ROLES)) {
    if (!spawns[i]) {
      return;
    }

    let roleName = Object.keys(ROLES)[j];
    let spawnSettings = ROLES[roleName].spawn(room);
    if (spawnSettings) {
      let partsImportance = [TOUGH, WORK, CARRY, CLAIM, RANGED_ATTACK, ATTACK, MOVE];
      spawnSettings.bodyParts.sort((a, b) => partsImportance.indexOf(a) - partsImportance.indexOf(b));

      let creepName = ROLES[roleName].coolName + '' + getRandomInt(10000);
      let ans = spawns[i].spawnCreep(spawnSettings.bodyParts, creepName, {
        memory: spawnSettings.memory
      });
      if (ans == OK) {
        spawnSettings.postSpawn();
        console.log('spawned ' + roleName);
        i += 1;
      }
    }
  }

  if (Game.time % 200 == 0) {
    console.log("^ role balance in room " + room.name + " ^");
  }
}


module.exports = roomSpawning;