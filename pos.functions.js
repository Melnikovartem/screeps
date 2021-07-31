RoomPosition.prototype.getNearbyPositions = function() {

};

RoomPosition.prototype.getOpenPositions = function() {
  let nearbyPositions = this.getNearbyPositions();

  let terrain = Game.map.getRoomTerrain(this.roomName);
  switch (terrain.get(this.x, this.y)) {
    case TERRAIN_MASK_WALL:
      break;
    case TERRAIN_MASK_SWAMP:
      break;
    case 0:
      break;
  }


};