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
    "harvester": 2,
    "upgrader": 2,
    "builder": 3,
}

emerency_roles = ["harvester"];

worker = [WORK,WORK,CARRY,CARRY,MOVE];
weak_worker = [WORK,CARRY,MOVE,MOVE];

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
          if (spawnCreepInMainRomm(role, worker) == ERR_NOT_ENOUGH_ENERGY) {
            if (emerency_roles.includes(role)) {
              console.log(role + ' turned out WEAK');
              spawnCreepInMainRomm(role, weak_worker);
            } else {
              //console.log(role + " wont be WEAK")
            }
          } else {
            console.log('spawned ' + role);
          }
        }
      }
	}
};


module.exports = buildingTower;
