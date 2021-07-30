require('constants')

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

function spawnCreepInMainRom(role, room, weak = 0) {
  var parts = target_identity[role][0];
  var type =  target_identity[role][1];
  var creep_name = type + '' + getRandomInt(10000);

  if (weak) {
    creep_name = 'WEAK' + creep_name;
    parts = WEAK_PARTS;
  }

  return Game.spawns[SPAWN_NAME].spawnCreep(parts,  creep_name, { memory: { role: role, type: type, switched: Game.time, homeroom: room.name } } );
}

function get_target() {
  let target = {};
  target[HARVESTERS_ROLENAME] = HARVESTERS_DESIRED;
  target[BUILDERS_ROLENAME]   = BUILDERS_DESIRED;
  target[UPGRADERS_ROLENAME]  = UPGRADERS_DESIRED;
  return target;
}

var target_identity = {};
target_identity[HARVESTERS_ROLENAME] = [BUMBLEBEE_PARTS, BUMBLEBEE_TYPENAME];
target_identity[BUILDERS_ROLENAME]   = [BUMBLEBEE_PARTS, BUMBLEBEE_TYPENAME];
target_identity[UPGRADERS_ROLENAME]  = [BUMBLEBEE_PARTS, BUMBLEBEE_TYPENAME];

function get_real(room) {
  let real = {};
  real[HARVESTERS_ROLENAME] = _.filter(Game.creeps, (creep) => creep.memory.role == HARVESTERS_ROLENAME && creep.memory.homeroom == room.name).length;
  real[BUILDERS_ROLENAME]   = _.filter(Game.creeps, (creep) => creep.memory.role == BUILDERS_ROLENAME   && creep.memory.homeroom == room.name).length;
  real[UPGRADERS_ROLENAME]  = _.filter(Game.creeps, (creep) => creep.memory.role == UPGRADERS_ROLENAME  && creep.memory.homeroom == room.name).length;

  return real;
}

function roomSpawning(room) {
    let real   = get_real(room);
    let target = get_target(room);


    if (Game.time % 200 == 0) {
      console.log("Room " + room.name + ":");
    }

    for (var role in target) {
      if (Game.time % 200 == 0) {
        console.log(role + ": " + real[role] + "/" + target[role]);
      }
      if (real[role] < target[role]) {
        if (spawnCreepInMainRom(role, room) == OK) {
          console.log('spawned ' + role);
          break;
        }
      }
    }
}


module.exports = roomSpawning;
