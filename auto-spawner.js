require('constants')

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

function spawnCreepInMainRomm(role, weak = 0) {
  var parts = target_identity[role][0];
  var type =  target_identity[role][1];
  var creep_name = type + '' + getRandomInt(1000);

  if (weak) {
    creep_name = 'WEAK' + creep_name;
    parts = WEAK_PARTS;
  }


  return Game.spawns[SPAWN_NAME].spawnCreep(parts,  creep_name, { memory: { role: role, type: type, switched: Game.time } } );
}

function count_roles(role) {
  return _.filter(Game.creeps, (creep) => creep.memory.role == role).length;
}

var target = {};
target[HARVESTERS_ROLENAME] = HARVESTERS_DESIRED;
target[BUILDERS_ROLENAME]   = BUILDERS_DESIRED;
target[UPGRADERS_ROLENAME]  = UPGRADERS_DESIRED;


var target_identity = {};
target_identity[HARVESTERS_ROLENAME] = [BUMBLEBEE_PARTS, BUMBLEBEE_TYPENAME];
target_identity[BUILDERS_ROLENAME]   = [BUMBLEBEE_PARTS, BUMBLEBEE_TYPENAME];
target_identity[UPGRADERS_ROLENAME]  = [BUMBLEBEE_PARTS, BUMBLEBEE_TYPENAME];

emerency_roles = [HARVESTERS_ROLENAME] //["harvester"];

var buildingTower = {

    /** @param {Tower} tower **/
    run: function(tower) {
      var real = {};
      real[HARVESTERS_ROLENAME] = count_roles(HARVESTERS_ROLENAME);
      real[BUILDERS_ROLENAME]   = count_roles(BUILDERS_ROLENAME);
      real[UPGRADERS_ROLENAME]  = count_roles(UPGRADERS_ROLENAME);


      for (role in target) {
        //console.log(role + ": " + real[role] + "/" + target[role]);
        if (real[role] < target[role]) {

          var ans = spawnCreepInMainRomm(role);
          if (ans == ERR_NOT_ENOUGH_ENERGY) {
            if (emerency_roles.includes(role) && real[role] == 0) { //real[role] * 2 < target[role]
              if (spawnCreepInMainRomm(role, 1) == OK) {
                console.log(role + ' turned out WEAK');
              }
            } else {
              //console.log(role + " wont be WEAK")
            }
          } else if (ans == OK) {
            console.log('spawned ' + role);
            break;
          }
        }
      }
	}
};


module.exports = buildingTower;
