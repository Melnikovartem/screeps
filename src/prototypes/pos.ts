import { Traveler } from "../Traveler/TravelerModified";
import { getRoomCoorinates } from "../abstract/utils";

Object.defineProperty(RoomPosition.prototype, "to_str", {
  get: function str() {
    return this.roomName + "_" + this.x + "_" + this.y;
  },
});

Object.defineProperty(RoomPosition.prototype, "enteranceToRoom", {
  get: function str() {
    const exits = Game.map.describeExits(this.roomName);
    if (this.y === 0 && exits[FIND_EXIT_TOP])
      return new RoomPosition(this.x, 49, exits[FIND_EXIT_TOP]!);
    else if (this.y === 49 && exits[FIND_EXIT_BOTTOM])
      return new RoomPosition(this.x, 0, exits[FIND_EXIT_BOTTOM]!);
    else if (this.x === 0 && exits[FIND_EXIT_LEFT])
      return new RoomPosition(49, this.y, exits[FIND_EXIT_LEFT]!);
    else if (this.x === 49 && exits[FIND_EXIT_RIGHT])
      return new RoomPosition(0, this.y, exits[FIND_EXIT_RIGHT]!);
    return null;
  },
});

RoomPosition.prototype.equal = function equal(pos: ProtoPos) {
  if (!(pos instanceof RoomPosition)) pos = pos.pos;
  return this.x === pos.x && this.y === pos.y && this.roomName === pos.roomName;
};

// i wanted to do in in linear math, but then i remebered: FUCKING exits
RoomPosition.prototype.getRoomRangeTo = function (
  pos: RoomPosition | Room | { pos: RoomPosition } | string,
  mode: "path" | "manh" | "lin" = "manh"
): number {
  let toRoom: string;
  if (pos instanceof Room) toRoom = pos.name;
  else if (pos instanceof RoomPosition) toRoom = pos.roomName;
  else if (typeof pos === "string") toRoom = pos;
  else toRoom = pos.pos.roomName;
  switch (mode) {
    case "path":
      const ans = Traveler.findRoute(this.roomName, toRoom, {
        ignoreCurrent: true,
      });
      if (ans) return Object.keys(ans).length - 1;
      return Infinity;
    case "manh":
      const c1 = getRoomCoorinates(this.roomName, false);
      const c2 = getRoomCoorinates(toRoom, false);
      return Math.abs(c1[0] - c2[0]) + Math.abs(c1[1] - c2[1]); // manhattan distance
    case "lin":
      return Game.map.getRoomLinearDistance(this.roomName, toRoom); // nathive linear
  }
};

RoomPosition.prototype.getPositionsInRange = function (
  range: number
): RoomPosition[] {
  const positions: RoomPosition[] = [];

  const startX = this.x >= range ? this.x - range : 0;
  const startY = this.y >= range ? this.y - range : 0;

  for (let x = startX; x <= this.x + range && x <= 49; x++) {
    for (let y = startY; y <= this.y + range && y <= 49; y++) {
      positions.push(new RoomPosition(x, y, this.roomName));
    }
  }

  return positions;
};

RoomPosition.prototype.getOpenPositions = function (
  ignoreCreeps?: boolean,
  range: number = 1
): RoomPosition[] {
  return _.filter(this.getPositionsInRange(range), (pos) =>
    pos.isFree(ignoreCreeps)
  );
};

RoomPosition.prototype.isFree = function (ignoreCreeps?: boolean): boolean {
  let ans =
    Game.map.getRoomTerrain(this.roomName).get(this.x, this.y) !==
    TERRAIN_MASK_WALL;

  if (ans && this.roomName in Game.rooms) {
    ans = !_.filter(
      this.lookFor(LOOK_STRUCTURES),
      (s) =>
        s.structureType !== STRUCTURE_ROAD &&
        !(
          s.structureType === STRUCTURE_RAMPART && (s as StructureRampart).my
        ) &&
        s.structureType !== STRUCTURE_CONTAINER
    ).length;

    if (ans && !ignoreCreeps) ans = !this.lookFor(LOOK_CREEPS).length;
  }

  return ans;
};

RoomPosition.prototype.getPosInDirection = function (
  direction: DirectionConstant
): RoomPosition {
  const cc: [number, number] = [this.x, this.y];
  switch (direction) {
    case TOP:
      --cc[1];
      break;
    case TOP_RIGHT:
      ++cc[0];
      --cc[1];
      break;
    case RIGHT:
      ++cc[0];
      break;
    case BOTTOM_RIGHT:
      ++cc[0];
      ++cc[1];
      break;
    case BOTTOM:
      ++cc[1];
      break;
    case BOTTOM_LEFT:
      --cc[0];
      ++cc[1];
      break;
    case LEFT:
      --cc[0];
      break;
    case TOP_LEFT:
      --cc[0];
      --cc[1];
      break;
  }

  let [x, y, we, ns] = [0, 0, "E", "S"];
  const par = /^([WE])([0-9]+)([NS])([0-9]+)$/.exec(this.roomName);
  if (par)
    // well the types are right
    [we, x, ns, y] = [par[1], +par[2], par[3], +par[4]];
  else
    return new RoomPosition(
      Math.min(Math.max(cc[0], 0), 49),
      Math.min(Math.max(cc[1], 0), 49),
      this.roomName
    );
  if (cc[0] < 0) {
    x += we === "E" ? -1 : 1;
    cc[0] = 49;
  } else if (cc[0] > 49) {
    x -= we === "E" ? -1 : 1;
    cc[0] = 0;
  }
  if (cc[1] < 0) {
    y += ns === "S" ? -1 : 1;
    cc[1] = 49;
  } else if (cc[1] > 49) {
    y -= ns === "S" ? -1 : 1;
    cc[1] = 0;
  }

  if (x < 0) we = we === "E" ? "W" : "E";
  if (y < 0) ns = we === "S" ? "N" : "S";

  return new RoomPosition(cc[0], cc[1], we + x + ns + y);
};

RoomPosition.prototype.getTimeForPath = function (target: ProtoPos): number {
  const path = Traveler.findTravelPath(this, target, {
    useFindRoute: true,
    ignoreCurrent: true,
  });
  let len = 0;
  _.forEach(path.path, (p) => {
    const terrain = Game.map.getRoomTerrain(p.roomName).get(p.x, p.y);
    switch (terrain) {
      case TERRAIN_MASK_SWAMP:
        if (
          !(
            p.roomName in Game.rooms &&
            p
              .lookFor(LOOK_STRUCTURES)
              .filter((s) => s.structureType === STRUCTURE_ROAD).length
          )
        ) {
          len += 5;
          break;
        }
        len += 1;
        break;
      default:
        len += 1;
        break;
    }
  });
  return len;
};

// cheap (in terms of CPU) est of dist
RoomPosition.prototype.getRangeApprox = function (
  obj: ProtoPos,
  calcType?: "linear"
) {
  let calc = (p: RoomPosition, a: ProtoPos) => p.getRangeTo(a);
  if (calcType === "linear")
    calc = (p: RoomPosition, a: ProtoPos) => {
      const posA = "pos" in a ? (a as { pos: RoomPosition }).pos : a;
      return Math.pow(p.x - posA.x, 2) + Math.pow(p.y - posA.y, 2);
    };

  const pos = "pos" in obj ? (obj as { pos: RoomPosition }).pos : obj;
  let newDistance = 0;
  const route = Game.map.findRoute(this.roomName, pos.roomName);
  let enterance: RoomPosition = this;
  let currentRoom = this.roomName;

  if (route === -2) newDistance = Infinity;
  else
    _.forEach(route, (routeStep) => {
      // not best in terms of calculations(cause can get better for same O(n)), but best that i can manage rn
      const exit: RoomPosition = new RoomPosition(
        Math.min(Math.max(enterance.x, 5), 44),
        Math.min(Math.max(enterance.y, 5), 44),
        currentRoom
      );
      switch (routeStep.exit) {
        case TOP:
          exit.y = 0;
          break;
        case BOTTOM:
          exit.y = 49;
          break;
        case LEFT:
          exit.x = 0;
          break;
        case RIGHT:
          exit.x = 49;
          break;
      }
      newDistance += calc(enterance, exit);
      enterance = exit.enteranceToRoom!;
      currentRoom = routeStep.room;
    });
  newDistance += calc(enterance, pos);
  return newDistance;
};

// couple of optimizations to make usability of getClosestByRange, but better
RoomPosition.prototype.findClosest = function <Obj extends ProtoPos>(
  objects: Obj[]
): Obj | null {
  if (objects.length === 0) return null;

  let ans: Obj = objects[0];
  let distance = Infinity;

  _.forEach(objects, (obj: Obj) => {
    const newDistance = this.getRangeApprox(obj);
    if (newDistance < distance) {
      ans = obj;
      distance = newDistance;
    } else if (newDistance === distance) {
      if (
        this.getRangeApprox(ans, "linear") > this.getRangeApprox(obj, "linear")
      )
        ans = obj;
    }
  });

  return ans;
};

RoomPosition.prototype.findClosestByTravel = function <Obj extends ProtoPos>(
  objects: Obj[],
  opt?: FindPathOpts
): Obj | null {
  if (objects.length === 0) return null;

  let ans: Obj = objects[0];
  let distance = Infinity;

  _.forEach(objects, (obj: Obj) => {
    const newDistance = Traveler.findTravelPath(this, obj, opt).path.length;
    if (newDistance < distance) {
      ans = obj;
      distance = newDistance;
    }
  });

  return ans;
};
