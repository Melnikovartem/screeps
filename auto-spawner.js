function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

function spawnCreepInMainRomm(role, parts) {
  var creep_name = role + '' + getRandomInt(1000);
  return Game.spawns['Spawn1'].spawnCreep(parts,  creep_name, { memory: { role: role } } );
}

//Game.spawns['Spawn1'].spawnCreep( [WORK,CARRY,MOVE],     'Builder_1',     { memory: { role: 'builder' } } );
function count_roles(role) {
  return _.filter(Game.creeps, (creep) => creep.memory.role == role).length;
}

var target = {
    "harvester": 5,
    "builder": 3,
    "upgrader": 2,
}

emerency_roles = [] //["harvester"];

worker = [WORK,WORK,CARRY,MOVE]; //300
carrier = [WORK,CARRY,CARRY,MOVE,MOVE]; //300
weak_worker = [WORK,CARRY,MOVE]; //200

var buildingTower = {

    /** @param {Tower} tower **/
    run: function(tower) {
      var real = {
        "harvester": count_roles('harvester'),
        "builder": count_roles('builder'),
        "upgrader": count_roles('upgrader')
      };


      for (role in target) {
        //console.log(role + ": " + real[role]);
        if (real[role] < target[role]) {

          var parts = worker;
          if (["upgrader", "builder"].includes(role))
            parts = carrier;

          var weak_parts = weak_worker;

          var ans = spawnCreepInMainRomm(role, parts);

          if (ans == ERR_NOT_ENOUGH_ENERGY) {
            if (emerency_roles.includes(role)) {
              console.log(role + ' turned out WEAK');
              spawnCreepInMainRomm(role, weak_parts);
            } else {
              //console.log(role + " wont be WEAK")
            }
          } else if (ans == OK) {
            console.log('spawned ' + role);
          }
        }
      }
	}
};


module.exports = buildingTower;
