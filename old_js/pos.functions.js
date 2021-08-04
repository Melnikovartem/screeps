RoomPosition.prototype.getNearbyPositions = function() {
  let positions = [];

  let startX = this.x - 1 || 1;
  let startY = this.y - 1 || 1;

  for (x = startX; x <= this.x + 1 && x < 49; x++) {
    for (y = startY; y <= this.y + 1 && y < 49; y++) {
      positions.push(new RoomPosition(x, y, this.roomName));
    }
  }

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

  let walkablePositions = _.filter(nearbyPositions, function(pos) {
    return terrain.get(pos.x, pos.y) != TERRAIN_MASK_WALL;
  });

  let freePosition = _.filter(walkablePositions, function(pos) {
    return !pos.lookFor(LOOK_CREEPS).length
  });

  return freePosition;
};


RoomPosition.prototype.getTimeForPath = function(roomPos) {
  let path = this.findPathTo(roomPos, {
    ignoreCreeps: true
  });

  //for future i need to iterate and check for roads
  return path.length
};