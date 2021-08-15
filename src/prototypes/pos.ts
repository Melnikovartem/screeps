interface RoomPosition {
  getRoomCoorinates(): number[];
  getRoomRangeTo(pos: RoomPosition | Room | { pos: RoomPosition }): number;
  getNearbyPositions(): RoomPosition[];
  getOpenPositions(ignoreCreeps?: boolean): RoomPosition[];
  isFree(ignoreCreeps?: boolean): boolean;
  getTimeForPath(pos: RoomPosition | { pos: RoomPosition }): number
  findClosest<Obj extends RoomPosition | { pos: RoomPosition }>(structures: Obj[]): Obj | null;
}

// i wanted to do in in linear math, but then i remebered: FUCKING exits
function getRoomCoorinates(roomName: string): number[] {
  let parsed = /^([WE])([0-9]+)([NS])([0-9]+)$/.exec(roomName);
  let x = 0;
  let y = 0;
  if (parsed) {
    x = <number><unknown>parsed[2] * (parsed[1] == "W" ? -1 : 0);
    y = <number><unknown>parsed[4] * (parsed[3] == "s" ? -1 : 0);
  }
  return [x, y];
}

RoomPosition.prototype.getRoomRangeTo = function(pos: RoomPosition | Room | { pos: RoomPosition }): number {
  let ans;
  if (pos instanceof Room)
    ans = Game.map.findRoute(this.roomName, pos.name);
  else if (pos instanceof RoomPosition)
    ans = Game.map.findRoute(this.roomName, pos.roomName);
  else
    ans = Game.map.findRoute(this.roomName, pos.pos.roomName);
  if (typeof ans != "number")
    ans = ans.length;
  return ans == -2 ? Infinity : ans;
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
}

RoomPosition.prototype.getOpenPositions = function(ignoreCreeps?: boolean): RoomPosition[] {
  let nearbyPositions: RoomPosition[] = this.getNearbyPositions();

  return _.filter(nearbyPositions, (pos) => pos.isFree(ignoreCreeps));
}

RoomPosition.prototype.isFree = function(ignoreCreeps?: boolean): boolean {
  let ans = true;

  if (ans)
    ans = Game.map.getRoomTerrain(this.roomName).get(this.x, this.y) != TERRAIN_MASK_WALL;

  if (this.roomName in Game.rooms) {
    if (ans && !ignoreCreeps)
      ans = this.lookFor(LOOK_CREEPS).length == 0

    if (ans)
      ans = _.filter(this.lookFor(LOOK_STRUCTURES), (structure) => !(structure instanceof StructureRoad)
        && !(structure instanceof StructureContainer)
        && !(structure instanceof StructureRampart && structure.my)).length == 0
  }

  return ans;
}


RoomPosition.prototype.getTimeForPath = function(target: RoomObject | RoomPosition): number {
  let pos: RoomPosition;
  if (target instanceof RoomObject)
    pos = target.pos;
  else
    pos = target;

  // need to write something smarter
  let len = this.findPathTo(pos, { ignoreCreeps: true }).length;

  if (pos.roomName != this.roomName)
    len += pos.findPathTo(this, { ignoreCreeps: true }).length;

  return len
}

// TODO different class types to forget casting in and out
RoomPosition.prototype.findClosest = function <Obj extends RoomPosition | { pos: RoomPosition }>(structures: Obj[]): Obj | null {
  if (structures.length == 0)
    return null;

  let ans: Obj = structures[0];
  let distance = Infinity;

  // TODO smarter room-to-room distance

  _.some(structures, (structure) => {
    let newDistance = this.getRangeTo(structure)
    if (newDistance < distance) {
      ans = structure;
      distance = newDistance;
    }
    if (distance == 1)
      return true;
    return false;
  });

  return ans;
}
