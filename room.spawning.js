require('constants')

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

function spawnCreepInMainRom(spawn, roleName, room) {

  if (!spawn)
    return

  let creep_name = ROLES[roleName].coolName + '' + getRandomInt(10000);

  return spawn.spawnCreep(ROLES[roleName].bodyParts,  creep_name, {
    memory: { role: roleName, born: Game.time, homeroom: room.name }
  });
}

function get_target(room) {
  let target = _.get(room.memory, ["roles"]);
  if (!target) {
    room.memory.roles = {
      harvester: 2,
      hauler: 1,
      builder: 1,
      upgrader: 2,
    }
    target = _.get(room.memory, ["roles"]);
  }
  return target;
}

function get_real(room) {
  let real = {};
  _.forEach(Object.keys(ROLES), function(roleName) {
    real[roleName] = _.filter(Game.creeps, (creep) => creep.memory.role == roleName && creep.memory.homeroom == room.name).length;
  });
  return real;
}

function roomSpawning(room) {
    let real   = get_real(room);
    let target = get_target(room);


    let spawns = room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_SPAWN }
    });
    spawns = _.filter(spawns, (structure) => structure.spawning == null);

    let i = 0;

    if (Game.time % 200 == 0) {
      console.log("Room " + room.name + ":");
    }


    _.forEach(Object.keys(ROLES), function(roleName) {
      if (Game.time % 200 == 0) {
        console.log(roleName + ": " + real[roleName] + "/" + target[roleName]);
      }
      if (real[roleName] < target[roleName]) {
        let ans = spawnCreepInMainRom(spawns[i], roleName, room);
        if (ans == OK) {
          console.log('spawned ' + roleName);
          i += 1;
        }
      }
    });
}


module.exports = roomSpawning;
