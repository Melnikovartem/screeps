function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

//Game.spawns['Spawn1'].spawnCreep( [WORK,CARRY,MOVE],     'Builder_1',     { memory: { role: 'builder' } } );
function count_roles(role) {
  return _.filter(Game.creeps, (creep) => creep.memory.role == role);
}

var target = {
    "harvester": 2,
    "upgrader": 2,
    "builder": 2,
}

var buildingTower = {

    /** @param {Tower} tower **/
    run: function(tower) {
      var real = {
        "harvester": count_roles('harvester'),
        "builder": count_roles('builder'),
        "upgrader": count_roles('upgrader')
      };

      for (name in target) {
        if (real[name] < target[name]) {
          var creep_name = name + '_' + getRandomInt(1000);
          console.log('spawning ' + creep_name)
          Game.spawns['Spawn1'].spawnCreep( [WORK,WORK,CARRY,MOVE],  creep_name,     { memory: { role: name } } );
        }
      }
	}
};


module.exports = buildingTower;
