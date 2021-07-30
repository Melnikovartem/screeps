var roleMain = require('role-main');
var buildingMain = require('building-main');
var autoSpawner = require('auto-spawner');

module.exports.loop = function () {
    for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            delete Memory.creeps[name];
            console.log('Clearing non-existing creep memory:', name);
        }
    }


    roleMain.run();
    buildingMain.run()
    autoSpawner.run();
}
