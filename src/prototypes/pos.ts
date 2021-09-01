interface RoomPosition {
  getRoomCoorinates(): number[];
  getRoomRangeTo(pos: RoomPosition | Room | { pos: RoomPosition }): number;
  getNearbyPositions(): RoomPosition[];
  getOpenPositions(ignoreCreeps?: boolean): RoomPosition[];
  isFree(ignoreCreeps?: boolean): boolean;
  getEnteranceToRoom(): RoomPosition | null;
  getTimeForPath(pos: RoomPosition | { pos: RoomPosition }): number;
  findClosest<Obj extends RoomPosition | { pos: RoomPosition }>(structures: Obj[]): Obj | null;
}

// i wanted to do in in linear math, but then i remebered: FUCKING exits
function getRoomCoorinates(roomName: string): number[] {
  let parsed = /^([WE])([0-9]+)([NS])([0-9]+)$/.exec(roomName);
  let x = 0;
  let y = 0;
  if (parsed) {
    x = <number><unknown>parsed[2] * (parsed[1] === "W" ? -1 : 0);
    y = <number><unknown>parsed[4] * (parsed[3] === "s" ? -1 : 0);
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
  if (typeof ans !== "number")
    ans = ans.length;
  return ans === -2 ? Infinity : ans;
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
    ans = Game.map.getRoomTerrain(this.roomName).get(this.x, this.y) !== TERRAIN_MASK_WALL;

  if (this.roomName in Game.rooms) {
    if (ans && !ignoreCreeps)
      ans = this.lookFor(LOOK_CREEPS).length === 0

    if (ans)
      ans = _.filter(this.lookFor(LOOK_STRUCTURES), (structure) => !(structure instanceof StructureRoad)
        && !(structure instanceof StructureContainer)
        && !(structure instanceof StructureRampart && structure.my)).length === 0
  }

  return ans;
}

const oppositeExit = {
  [FIND_EXIT_TOP]: FIND_EXIT_BOTTOM,
  [FIND_EXIT_RIGHT]: FIND_EXIT_LEFT,
  [FIND_EXIT_BOTTOM]: FIND_EXIT_TOP,
  [FIND_EXIT_LEFT]: FIND_EXIT_RIGHT,
}

RoomPosition.prototype.getEnteranceToRoom = function(): RoomPosition | null {
  let exits = Game.map.describeExits(this.roomName);
  if (exits[FIND_EXIT_TOP] && this.y === 0)
    return new RoomPosition(this.x, 49, exits[FIND_EXIT_TOP]!);
  else if (exits[FIND_EXIT_BOTTOM] && this.y === 49)
    return new RoomPosition(this.x, 0, exits[FIND_EXIT_BOTTOM]!);
  else if (exits[FIND_EXIT_LEFT] && this.x === 0)
    return new RoomPosition(49, this.y, exits[FIND_EXIT_LEFT]!);
  else if (exits[FIND_EXIT_RIGHT] && this.x === 49)
    return new RoomPosition(0, this.y, exits[FIND_EXIT_RIGHT]!);
  return null;
}

// costly be careful
RoomPosition.prototype.getTimeForPath = function(target: RoomPosition | { pos: RoomPosition }): number {
  let pos: RoomPosition;
  if (target instanceof RoomPosition)
    pos = target;
  else
    pos = target.pos;

  // ignore terrain cost cause it depends on creep
  let len = 0;
  let route = Game.map.findRoute(this.roomName, pos.roomName);
  let enterance: RoomPosition | FIND_EXIT_TOP | FIND_EXIT_RIGHT | FIND_EXIT_BOTTOM | FIND_EXIT_LEFT = this;
  let currentRoom = this.roomName;

  if (route !== -2)
    for (let i in route) {
      let room = Game.rooms[currentRoom];
      let newEnterance: RoomPosition | FIND_EXIT_TOP | FIND_EXIT_RIGHT | FIND_EXIT_BOTTOM | FIND_EXIT_LEFT | null = null;
      if (room) {
        if (!(enterance instanceof RoomPosition))
          enterance = room.find(enterance)[0];
        // not best in terms of calculations(cause can get better for same O(n)), but best that i can manage rn
        let exit: RoomPosition | null = (<RoomPosition>enterance).findClosestByPath(room.find(route[i].exit));

        if (exit) {
          len += enterance.findPathTo(exit, { ignoreCreeps: true }).length;
          newEnterance = exit.getEnteranceToRoom();
        }
      } else
        len += 15;


      if (!newEnterance)
        newEnterance = oppositeExit[route[i].exit];
      enterance = newEnterance;
      currentRoom = route[i].room;
    }

  // last currentRoom === pos.roomName
  if (pos.roomName in Game.rooms) {
    if (!(enterance instanceof RoomPosition))
      enterance = Game.rooms[pos.roomName].find(enterance)[0];
    len += enterance.findPathTo(pos, { ignoreCreeps: true }).length;
  }

  return len;
}

let getRangeToWall: { [id: number]: (a: RoomPosition) => number } = {
  [FIND_EXIT_TOP]: (pos) => pos.y,
  [FIND_EXIT_BOTTOM]: (pos) => 49 - pos.y,
  [FIND_EXIT_LEFT]: (pos) => pos.x,
  [FIND_EXIT_RIGHT]: (pos) => 49 - pos.x,
}

// couple of optimizations to make usability of getClosestByRange, but better
RoomPosition.prototype.findClosest = function <Obj extends RoomPosition | { pos: RoomPosition }>(objects: Obj[]): Obj | null {
  if (objects.length === 0)
    return null;

  let ans: Obj = objects[0];
  let distance = Infinity;

  _.some(objects, (object: Obj) => {
    let pos: RoomPosition;
    if (object instanceof RoomPosition)
      pos = object;
    else
      pos = (<{ pos: RoomPosition }>object).pos;

    let newDistance = 0;
    if (this.roomName === pos.roomName)
      newDistance = this.getRangeTo(pos); // aka Math.max(abs(pos1.x-pos2.x), abs(pos.y-pos2.y))
    else {
      //cheap est of dist
      let outOfRoom = 25;
      if (this.roomName in Game.rooms) {
        let exit = Game.rooms[this.roomName].findExitTo(pos.roomName);
        if (exit > 0)
          outOfRoom = getRangeToWall[exit](this) * 1.2;
      }
      let inRoom = 25;
      if (pos.roomName in Game.rooms) {
        let exit = Game.rooms[pos.roomName].findExitTo(this.roomName);
        if (exit > 0)
          inRoom = getRangeToWall[exit](pos) * 1.2;
      }

      newDistance += Math.ceil(outOfRoom + inRoom + (this.getRoomRangeTo(pos) - 1) * 25);
    }
    if (newDistance < distance) {
      ans = object;
      distance = newDistance;
    } else if (newDistance === distance) {
      // i thought of linear dist but it is not good at all in this world
      if (Math.random() > 0.8)
        ans = object; // just a random chance to invalidate this object (so getClosest wouldn't prefer the top left ones)
      //i didn't rly calculate the E of this ans, but surely it is satisfactory
    }

    if (distance === 1)
      return true;
    return false;
  });

  return ans;
}
