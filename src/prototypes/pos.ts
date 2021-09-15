interface RoomPosition {
  getRoomCoorinates(): [number, number, string, string];
  getRoomRangeTo(pos: RoomPosition | Room | { pos: RoomPosition } | string, pathfind?: boolean): number;
  getPositionsInRange(range?: number): RoomPosition[];
  getOpenPositions(ignoreCreeps?: boolean, range?: number): RoomPosition[];
  isFree(ignoreCreeps?: boolean): boolean;
  getEnteranceToRoom(): RoomPosition | null;
  getTimeForPath(pos: RoomPosition | { pos: RoomPosition }): number;
  findClosest<Obj extends RoomPosition | { pos: RoomPosition }>(structures: Obj[]): Obj | null;
}

function getRoomCoorinates(roomName: string): [number, number] {
  let parsed = /^([WE])([0-9]+)([NS])([0-9]+)$/.exec(roomName);
  let x = 0;
  let y = 0;
  if (parsed) {
    x = (+parsed[2]) * (parsed[1] === "W" ? -1 : 1);
    y = (+parsed[4]) * (parsed[3] === "s" ? -1 : 1);
  }
  return [x, y];
}

RoomPosition.prototype.getRoomCoorinates = function getRoomCoorinates() {
  let parsed = /^([WE])([0-9]+)([NS])([0-9]+)$/.exec(this.roomName);
  let x = 0;
  let y = 0;
  if (parsed) {
    x = (+parsed[2]) * (parsed[1] === "W" ? -1 : 1);
    y = (+parsed[4]) * (parsed[3] === "s" ? -1 : 1);
    return [x, y, parsed[1], parsed[3]];
  }
  return [0, 0, "E", "S"];
}

// i wanted to do in in linear math, but then i remebered: FUCKING exits
RoomPosition.prototype.getRoomRangeTo = function(pos: RoomPosition | Room | { pos: RoomPosition } | string, pathfind: boolean = false): number {
  let toRoom: string;
  if (pos instanceof Room)
    toRoom = pos.name;
  else if (pos instanceof RoomPosition)
    toRoom = pos.roomName;
  else if (typeof pos === "string")
    toRoom = pos;
  else
    toRoom = pos.pos.roomName;
  if (pathfind) {
    let ans = Game.map.findRoute(this.roomName, toRoom);
    if (ans !== -2)
      return ans.length;
    return Infinity;
  } else {
    let c1 = getRoomCoorinates(this.roomName);
    let c2 = getRoomCoorinates(toRoom);
    return Math.abs(c1[0] - c2[0]) + Math.abs(c1[1] - c2[1]);
  }
}

RoomPosition.prototype.getPositionsInRange = function(range: number = 1): RoomPosition[] {
  let positions: RoomPosition[] = [];

  let startX = this.x >= range ? this.x - range : 0;
  let startY = this.y >= range ? this.y - range : 0;

  for (let x = startX; x <= this.x + range && x <= 49; x++) {
    for (let y = startY; y <= this.y + range && y <= 49; y++) {
      positions.push(new RoomPosition(x, y, this.roomName));
    }
  }

  return positions
}

RoomPosition.prototype.getOpenPositions = function(ignoreCreeps?: boolean, range: number = 1): RoomPosition[] {
  let nearbyPositions: RoomPosition[] = this.getPositionsInRange(range);

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

  _.some(objects, (obj: Obj) => {
    let pos = "pos" in obj ? (<{ pos: RoomPosition }>obj).pos : <RoomPosition>obj;

    let newDistance = 0;
    //cheap (in terms of CPU) est of dist

    let route = Game.map.findRoute(this.roomName, pos.roomName);
    let enterance: RoomPosition | FIND_EXIT_TOP | FIND_EXIT_RIGHT | FIND_EXIT_BOTTOM | FIND_EXIT_LEFT = this;
    let currentRoom = this.roomName;

    if (route === -2)
      newDistance = Infinity;
    else
      for (let i in route) {
        let room = Game.rooms[currentRoom];
        let newEnterance: RoomPosition | FIND_EXIT_TOP | FIND_EXIT_RIGHT | FIND_EXIT_BOTTOM | FIND_EXIT_LEFT | null = null;
        if (room) {
          if (!(enterance instanceof RoomPosition))
            enterance = room.find(enterance)[0];
          // not best in terms of calculations(cause can get better for same O(n)), but best that i can manage rn
          let exit: RoomPosition | null = (<RoomPosition>enterance).findClosestByRange(room.find(route[i].exit));

          if (exit) {
            newDistance += enterance.getRangeTo(exit);
            newEnterance = exit.getEnteranceToRoom();
          }
        } else
          newDistance += 15;


        if (!newEnterance)
          newEnterance = oppositeExit[route[i].exit];
        enterance = newEnterance;
        currentRoom = route[i].room;
      }

    if (pos.roomName in Game.rooms) {
      if (!(enterance instanceof RoomPosition))
        enterance = Game.rooms[pos.roomName].find(enterance)[0];
      newDistance += enterance.getRangeTo(pos); // aka Math.max(abs(pos1.x-pos2.x), abs(pos.y-pos2.y))
    }

    if (newDistance < distance) {
      ans = obj;
      distance = newDistance;
    } else if (newDistance === distance) {
      // i thought of linear dist but it is not good at all in this world
      if (Math.random() > 0.8)
        ans = obj; // just a random chance to invalidate this object (so getClosest wouldn't prefer the top left ones)
      //i didn't rly calculate the E of this ans, but surely it is satisfactory
    }

    return distance <= 1;
  });


  return ans;
}
