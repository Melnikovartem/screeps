var buildingTower = require('building.tower');

var buildingMain = {

    /** @param **/
    run: function() {
      var tower = Game.getObjectById('e4433f6c8bf19d7ccdc2f531');
      if(tower) {
          buildingTower.run(tower)
      }

      for(var name in Game.structures) {
          var structure = Game.structures[name];


          if(structure.structureType == STRUCTURE_TOWER) {
              buildingTower.run(structure);
          }
      }
	}
};


module.exports = buildingMain;
