function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

function roomSpawning(room) {
  let spawns = room.find(FIND_MY_STRUCTURES, {
    filter: {
      structureType: STRUCTURE_SPAWN;
    }
  });
  spawns = _.filter(spawns, (structure) => structure.spawning == null);

  let i = 0;

  for (let roleName in ROLES) {
    if (!spawns[i]) {
      return;
    }

    let spawnSettings = ROLES[roleName].spawn(room);

    if (spawnSettings) {
      // optimizing movement cpu or smth?
      let partsImportance = [TOUGH, MOVE, WORK, CARRY, CLAIM, RANGED_ATTACK, ATTACK, HEAL];
      spawnSettings.bodyParts.sort((a, b) => partsImportance.indexOf(a) - partsImportance.indexOf(b));

      let creepName = ROLES[roleName].coolName + '' + getRandomInt(10000);
      let ans = spawns[i].spawnCreep(spawnSettings.bodyParts, creepName, {
        memory: spawnSettings.memory
      });

      if (ans == OK) {
        spawnSettings.postSpawn(creepName);
        i += 1;
      } else if (ans == ERR_NOT_ENOUGH_RESOURCES && roleName == "harvester") {
        // another fail-safe for my economy
        //prob never will work cause same fail-safe in harvest spaw logic :/
        return;
      }
    }
  }
}


module.exports = roomSpawning;
