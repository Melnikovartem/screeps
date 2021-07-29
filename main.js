var roleMain = require('role-main');

var buildingMain = require('building-main');

module.exports.loop = function () {
    for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            delete Memory.creeps[name];
            console.log('Clearing non-existing creep memory:', name);
        }
    }

  
    buildingMain.run()
    roleMain.run();
}
