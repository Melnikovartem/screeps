function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

function spawnCreepInMainRomm(role, parts) {
  var creep_name = role + '' + getRandomInt(1000);
  console.log('spawning ' + creep_name)
  return Game.spawns['Spawn1'].spawnCreep(parts,  creep_name,   { memory: { role: role } } );
}

//Game.spawns['Spawn1'].spawnCreep( [WORK,CARRY,MOVE],     'Builder_1',     { memory: { role: 'builder' } } );
function count_roles(role) {
  return _.filter(Game.creeps, (creep) => creep.memory.role == role).length;
}

var target = {
    "harvester": 2,
    "upgrader": 2,
    "builder": 4,
}

var worker = [WORK,WORK,CARRY,CARRY,MOVE];
var weak_worker = [WORK,CARRY,MOVE,MOVE];

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
            console.log('it turned out WEAK');
            spawnCreepInMainRomm(role, weak_worker);
          }
        }
      }
	}
};


module.exports = buildingTower;
