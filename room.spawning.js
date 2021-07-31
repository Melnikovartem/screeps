require('constants')

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

function spawnCreepInMainRom(spawn, role, room, weak = 0) {

  if (!spawn)
    return

  var parts = target_identity[role][0];
  var type =  target_identity[role][1];
  var creep_name = type + '' + getRandomInt(10000);

  if (weak) {
    creep_name = 'WEAK' + creep_name;
    parts = WEAK_PARTS;
  }

  return spawn.spawnCreep(parts,  creep_name, { memory: { role: role, type: type, switched: Game.time, homeroom: room.name } } );
}

function get_target(room) {
  let target = _.get(room.memory, ["roles"]);
  if (!target) {
    room.memory.roles = {
      harvester: HARVESTERS_DESIRED,
      builder: BUILDERS_DESIRED,
      upgrader: BUILDERS_DESIRED,
    }
    target = _.get(room.memory, ["roles"]);
  }
  return target;
}

var target_identity = {};
target_identity[HARVESTERS_ROLENAME] = [BUMBLEBEE_PARTS, BUMBLEBEE_TYPENAME];
target_identity[BUILDERS_ROLENAME]   = [BUMBLEBEE_PARTS, BUMBLEBEE_TYPENAME];
target_identity[UPGRADERS_ROLENAME]  = [BUMBLEBEE_PARTS, BUMBLEBEE_TYPENAME];

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
        if (spawnCreepInMainRom(spawns[i], roleName, room) == OK) {
          console.log('spawned ' + roleName);
          i += 1;
        }
      }
    });
}


module.exports = roomSpawning;
