function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

//Game.spawns['Spawn1'].spawnCreep( [WORK,CARRY,MOVE],     'Builder_1',     { memory: { role: 'builder' } } );
function count_roles(role) {
  return _.filter(Game.creeps, (creep) => creep.memory.role == role);
}

var target = {
    "harvesters": 2,
    "upgraders": 2,
    "builders": 2,
}

var buildingTower = {

    /** @param {Tower} tower **/
    run: function(tower) {
      var real = {
        "harvesters": count_roles('harvester'),
        "builders": count_roles('builders'),
        "upgraders": count_roles('upgraders')
      };

      for (name in target) {
        if (real[name] < target[name]) {
          Game.spawns['Spawn1'].spawnCreep( [WORK,WORK,CARRY,MOVE],  name + '_' + getRandomInt(1000),     { memory: { role: name } } );
        }
      }
	}
};


module.exports = buildingTower;
