require('constants')

var target = {};
target[HARVESTERS_ROLENAME] = HARVESTERS_DESIRED;
target[BUILDERS_ROLENAME]   = BUILDERS_DESIRED;
target[UPGRADERS_ROLENAME]  = UPGRADERS_DESIRED;


var target_identity = {};
target_identity[HARVESTERS_ROLENAME] = [BUMBLEBEE_PARTS, BUMBLEBEE_TYPENAME];
target_identity[BUILDERS_ROLENAME]   = [BUMBLEBEE_PARTS, BUMBLEBEE_TYPENAME];
target_identity[UPGRADERS_ROLENAME]  = [BUMBLEBEE_PARTS, BUMBLEBEE_TYPENAME];

var emergency_roles = [HARVESTERS_ROLENAME] //["harvester"];

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

function spawnCreepInMainRom(role, weak = 0) {
  var parts = target_identity[role][0];
  var type =  target_identity[role][1];
  var creep_name = type + '' + getRandomInt(10000);

  if (weak) {
    creep_name = 'WEAK' + creep_name;
    parts = WEAK_PARTS;
  }


  return Game.spawns[SPAWN_NAME].spawnCreep(parts,  creep_name, { memory: { role: role, type: type, switched: Game.time } } );
}

function count_roles(role) {
  return _.filter(Game.creeps, (creep) => creep.memory.role == role).length;
}


function roomSpawning(room) {
    var real = {};
    real[HARVESTERS_ROLENAME] = count_roles(HARVESTERS_ROLENAME);
    real[BUILDERS_ROLENAME]   = count_roles(BUILDERS_ROLENAME);
    real[UPGRADERS_ROLENAME]  = count_roles(UPGRADERS_ROLENAME);


    for (var role in target) {
      if (Game.time % 100 == 0)
        console.log(role + ": " + real[role] + "/" + target[role]);
      if (real[role] < target[role]) {
        if (spawnCreepInMainRom(role) == OK) {
          console.log('spawned ' + role);
          break;
        }
      }
    }
}


module.exports = roomSpawning;
