
//Game.spawns['Spawn1'].spawnCreep( [WORK,CARRY,MOVE],     'Builder_1',     { memory: { role: 'builder' } } );
function count_roles(role) {
  return _.filter(Game.creeps, (creep) => creep.memory.role == role);
}

var real = {
  "harvesters": count_roles('harvester'),
  "builders": count_roles('builders'),
  "upgraders": count_roles('upgraders')
};

var target = {
    "harvesters": 2,
    "builders": 2,
    "upgraders": 2
}
