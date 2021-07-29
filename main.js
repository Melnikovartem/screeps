var roleMain = require('role-main');

var buildingTower = require('building.tower');

module.exports.loop = function () {

    var tower = Game.getObjectById('e4433f6c8bf19d7ccdc2f531');
    if(tower) {
        buildingTower.run(tower)
    }

    roleMain.run();
}
