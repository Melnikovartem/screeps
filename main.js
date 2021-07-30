
var buildingMain = require('building-main');
var autoSpawner = require('auto-spawner');

var roomLoop = require('rooms');
var roleLoop = require('roles');

var creepFuncitons = require('role.functions');


module.exports.loop = function () {
    for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            delete Memory.creeps[name];
            console.log('Clearing non-existing creep memory:', name);
        }
    }

    roleLoop();
    roomLoop();
}
