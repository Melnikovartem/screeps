interface RoomPosition {
  getNearbyPositions(): RoomPosition[];
  getOpenPositions(): RoomPosition[];
  getWalkablePositions(): RoomPosition[];
  getTimeForPath(roomPos: RoomPosition): number;
  findClosest<Obj extends RoomObject>(structures: Obj[]): Obj | null;
}

RoomPosition.prototype.getNearbyPositions = function(): RoomPosition[] {
  let positions: RoomPosition[] = [];

  let startX = this.x - 1 || 1;
  let startY = this.y - 1 || 1;

  for (let x = startX; x <= this.x + 1 && x < 49; x++) {
    for (let y = startY; y <= this.y + 1 && y < 49; y++) {
      positions.push(new RoomPosition(x, y, this.roomName));
    }
  }

  return positions
};

RoomPosition.prototype.getWalkablePositions = function(): RoomPosition[] {
  let nearbyPositions: RoomPosition[] = this.getNearbyPositions();

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

  return walkablePositions;
};

RoomPosition.prototype.getOpenPositions = function(): RoomPosition[] {
  let walkablePositions: RoomPosition[] = this.getWalkablePositions();

  let freePositions = _.filter(walkablePositions, function(pos) {
    return !pos.lookFor(LOOK_CREEPS).length
  });

  return freePositions;
}


RoomPosition.prototype.getTimeForPath = function(roomPos: RoomPosition): number {
  let path = this.findPathTo(roomPos, {
    ignoreCreeps: true
  });

  //for future i need to iterate and check for roads
  return path.length
};

// TODO different class types to forget casting in and out
RoomPosition.prototype.findClosest = function <Obj extends RoomObject>(structures: Obj[]): Obj | null {
  if (structures.length == 0)
    return null;

  let ans: Obj = structures[0];
  let distance = Infinity;

  // TODO smarter room-to-room distance

  _.forEach(structures, (structure) => {
    let newDistance = this.getRangeTo(structure)
    if (newDistance < distance) {
      ans = structure;
      distance = newDistance;
    }
  });

  return ans;
}
