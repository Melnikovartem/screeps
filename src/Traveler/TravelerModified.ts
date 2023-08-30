/**
 * To start using Traveler, require it in main.js:
 * Example: var Traveler = require('Traveler.js');
 */
import { profile } from "../profiler/decorator";
import { TRAVELER_MESSAGE, VISUALS_TRAVELER } from "../settings";
import { roomStates } from "../static/enums";

// this might be higher than you wish, setting it lower is a great way to diagnose creep behavior issues. When creeps
// need to repath to often or they aren't finding valid paths, it can sometimes point to problems elsewhere in your code
const REPORT_CPU_THRESHOLD = 1000;

export const DEFAULT_MAXOPS = 20000;
export const DEFAULT_STUCK_VALUE = 3;
export const STATE_PREV_X = 0;
export const STATE_PREV_Y = 1;
export const STATE_STUCK = 2;
export const STATE_CPU = 3;
export const STATE_DEST_X = 4;
export const STATE_DEST_Y = 5;
export const STATE_DEST_ROOMNAME = 6;

@profile
export class Traveler {
  private static structureMatrixCache: { [roomName: string]: CostMatrix } = {};
  private static creepMatrixCache: { [roomName: string]: CostMatrix } = {};
  private static creepMatrixTick: number;
  private static structureMatrixTick: number;

  /**
   * move creep to destination
   * @param creep
   * @param destination
   * @param options
   * @returns {number}
   */

  public static travelTo(
    creep: Creep | PowerCreep,
    destination: HasPos | RoomPosition,
    options: TravelToOptions = {}
  ): ScreepsReturnCode | RoomPosition {
    /* if (!destination) {
      return ERR_INVALID_ARGS;
    } */

    if ((creep as Creep).fatigue > 0) {
      Traveler.circle(creep.pos, "aqua", 0.3);
      return ERR_TIRED;
    }

    destination = this.normalizePos(destination);

    // manage case where creep is nearby destination
    const rangeToDestination = creep.pos.getRangeTo(destination);
    if (options.range && rangeToDestination <= options.range) {
      return OK;
    } else if (rangeToDestination <= 1) {
      if (rangeToDestination === 1 && !options.range) {
        const direction = creep.pos.getDirectionTo(destination);
        if (options.returnData) {
          options.returnData.nextPos = destination;
          options.returnData.path = direction.toString();
        }
        return destination;
      }
      return OK;
    }

    // initialize data object
    if (!creep.memory._trav) {
      delete creep.memory._travel;
      creep.memory._trav = {};
    }
    const travelData = creep.memory._trav as TravelData;

    const state = this.deserializeState(travelData, destination);

    // uncomment to visualize destination
    // this.circle(destination.pos, "orange");

    // check if creep is stuck
    if (this.isStuck(creep, state)) {
      state.stuckCount++;
      Traveler.circle(creep.pos, "magenta", state.stuckCount * 0.2);
    } else {
      state.stuckCount = 0;
    }

    // handle case where creep is stuck
    if (!options.stuckValue) {
      options.stuckValue = DEFAULT_STUCK_VALUE;
    }
    if (state.stuckCount >= options.stuckValue && Math.random() > 0.5) {
      // console.log(`<a href=#!/room/${Game.shard.name}/${creep.pos.roomName}>["${creep.name}"]</a>`, state.stuckCount);
      options.ignoreCreeps = false;
      options.freshMatrix = true;
      delete travelData.path;
      if (state.stuckCount >= options.stuckValue * 4 && !options.roomCallback)
        options.roomCallback = (roomName, matrix) => {
          const terrain = Game.map.getRoomTerrain(roomName);
          const enemies = Apiary.intel
            .getInfo(roomName, 50)
            .enemies.filter((e) => e.dangerlvl >= 4);
          _.forEach(enemies, (c) => {
            let fleeDist = 0;
            if (c.object instanceof Creep)
              fleeDist = Apiary.intel.getFleeDist(c.object);
            if (!fleeDist) return;
            _.forEach(c.object.pos.getPositionsInRange(fleeDist), (p) => {
              if (
                p
                  .lookFor(LOOK_STRUCTURES)
                  .filter(
                    (s) =>
                      s.structureType === STRUCTURE_RAMPART &&
                      (s as StructureRampart).my &&
                      s.hits > 10000
                  ).length
              )
                return;
              const coef = terrain.get(p.x, p.y) === TERRAIN_MASK_SWAMP ? 5 : 1;
              const posRangeToEnemy = p.getRangeTo(c.object);
              const val = Math.min(
                0x88,
                0x20 * coef * (fleeDist + 1 - posRangeToEnemy)
              );
              if (val > matrix.get(p.x, p.y)) matrix.set(p.x, p.y, val);
            });
            matrix.set(c.object.pos.x, c.object.pos.y, 0xff);
          });
          return matrix;
        };
    }

    // TODO:handle case where creep moved by some other function, but destination is still the same

    // delete path cache if destination is different
    if (!this.samePos(state.destination, destination)) {
      if (options.movingTarget && state.destination.isNearTo(destination)) {
        travelData.path! += state.destination.getDirectionTo(destination);
        state.destination = destination;
      } else {
        delete travelData.path;
      }
    }

    if (options.repath && Math.random() < options.repath) {
      // add some chance that you will find a new path randomly
      delete travelData.path;
    }

    // pathfinding
    let newPath = false;
    if (!travelData.path) {
      newPath = true;
      if ((creep as Creep).spawning) {
        return ERR_BUSY;
      }

      state.destination = destination;

      const cpu = Game.cpu.getUsed();
      const ret = this.findTravelPath(creep.pos, destination, options);

      const cpuUsed = Game.cpu.getUsed() - cpu;
      state.cpu = _.round(cpuUsed + state.cpu); // accumulated cpu over ticks
      if (state.cpu > REPORT_CPU_THRESHOLD && TRAVELER_MESSAGE) {
        // see note at end of file for more info on this
        console.log(
          `TRAVELER: heavy cpu use: ${
            (Apiary.bees[creep.name] && Apiary.bees[creep.name].print) ||
            creep.name
          }, cpu: ${state.cpu} origin: ${creep.pos.print}, dest: ${
            destination.print
          }`
        );
      }

      let color = "orange";
      if (ret.incomplete) {
        // uncommenting this is a great way to diagnose creep behavior issues
        // console.log(`TRAVELER: incomplete path for ${creep.name}`);
        color = "red";
      }

      if (options.returnData) {
        options.returnData.pathfinderReturn = ret;
      }

      travelData.path = Traveler.serializePath(creep.pos, ret.path, color);
      state.stuckCount = 0;
    }

    this.serializeState(creep, destination, state, travelData);

    if (!travelData.path || travelData.path.length === 0) {
      return ERR_NO_PATH;
    }

    // consume path
    if (state.stuckCount === 0 && !newPath) {
      travelData.path = travelData.path.substr(1);
    }

    const nextDirection = parseInt(travelData.path[0], 10);
    if (options.returnData) {
      if (nextDirection) {
        const nextPos = Traveler.positionAtDirection(creep.pos, nextDirection);
        if (nextPos) {
          options.returnData.nextPos = nextPos;
        }
      }
      options.returnData.state = state;
      options.returnData.path = travelData.path;
    }

    return creep.pos.getPosInDirection(nextDirection as DirectionConstant);
  }

  /**
   * make position objects consistent so that either can be used as an argument
   * @param destination
   * @returns {any}
   */

  public static normalizePos(destination: HasPos | RoomPosition): RoomPosition {
    if (!(destination instanceof RoomPosition)) {
      return destination.pos;
    }
    return destination;
  }

  /**
   * check if room should be avoided by findRoute algorithm
   * @param roomName
   * @returns {RoomMemory|number}
   */

  public static checkAvoid(roomName: string): boolean {
    const roomState = Apiary.intel.getRoomState(roomName);
    return roomState === roomStates.ownedByEnemy;
  }

  /**
   * check if a position is an exit
   * @param pos
   * @returns {boolean}
   */

  public static isExit(pos: Coord): boolean {
    return pos.x === 0 || pos.y === 0 || pos.x === 49 || pos.y === 49;
  }

  /**
   * check two coordinates match
   * @param pos1
   * @param pos2
   * @returns {boolean}
   */

  public static sameCoord(pos1: Coord, pos2: Coord): boolean {
    return pos1.x === pos2.x && pos1.y === pos2.y;
  }

  /**
   * check if two positions match
   * @param pos1
   * @param pos2
   * @returns {boolean}
   */

  public static samePos(pos1: RoomPosition, pos2: RoomPosition): boolean {
    return this.sameCoord(pos1, pos2) && pos1.roomName === pos2.roomName;
  }

  /**
   * draw a circle at position
   * @param pos
   * @param color
   * @param opacity
   */

  public static circle(pos: RoomPosition, color: string, opacity?: number) {
    if (VISUALS_TRAVELER)
      new RoomVisual(pos.roomName).circle(pos, {
        radius: 0.45,
        fill: "transparent",
        stroke: color,
        strokeWidth: 0.15,
        opacity,
      });
  }

  /**
   * find a path from origin to destination
   * @param origin
   * @param destination
   * @param options
   * @returns {PathfinderReturn}
   */

  public static findTravelPath(
    origin: RoomPosition | HasPos,
    destination: RoomPosition | HasPos,
    options: TravelToOptions = {}
  ): PathfinderReturn {
    _.defaults(options, {
      ignoreCreeps: true,
      maxOps: DEFAULT_MAXOPS,
      range: 1,
    });

    if (options.movingTarget) {
      options.range = 0;
    }

    origin = this.normalizePos(origin);
    destination = this.normalizePos(destination);
    const originRoomName = origin.roomName;
    const destRoomName = destination.roomName;

    // check to see whether findRoute should be used
    const roomDistance = Game.map.getRoomLinearDistance(
      origin.roomName,
      destination.roomName
    );
    let allowedRooms = options.route;
    if (
      !allowedRooms &&
      (options.useFindRoute ||
        (options.useFindRoute === undefined && roomDistance > 2))
    ) {
      const route = this.findRoute(
        origin.roomName,
        destination.roomName,
        options
      );
      if (route) {
        allowedRooms = route;
      }
    }

    // let roomsSearched = 0; // this was never used -_- SUS

    const callback = (roomName: string): CostMatrix | boolean => {
      if (allowedRooms) {
        if (!allowedRooms[roomName]) {
          return false;
        }
      } else if (
        !options.allowHostile &&
        Traveler.checkAvoid(roomName) &&
        roomName !== destRoomName &&
        roomName !== originRoomName
      ) {
        return false;
      }

      // roomsSearched++;

      let matrix;
      const room = Game.rooms[roomName];
      if (room) {
        if (options.ignoreStructures) {
          matrix = new PathFinder.CostMatrix();
          if (!options.ignoreCreeps) {
            Traveler.addCreepsToMatrix(room, matrix);
          }
        } else if (options.ignoreCreeps || roomName !== originRoomName) {
          matrix = this.getStructureMatrix(room, options.freshMatrix);
        } else {
          matrix = this.getCreepMatrix(room);
        }

        if (options.obstacles) {
          matrix = matrix.clone();
          for (const obstacle of options.obstacles) {
            if (obstacle.pos.roomName !== roomName) {
              continue;
            }
            matrix.set(obstacle.pos.x, obstacle.pos.y, 0xff);
          }
        }
      }

      if (options.roomCallback) {
        if (!matrix) {
          matrix = new PathFinder.CostMatrix();
        }
        const outcome = options.roomCallback(roomName, matrix.clone());
        if (outcome !== undefined) {
          return outcome;
        }
      }

      return matrix as CostMatrix;
    };

    let ret = PathFinder.search(
      origin,
      { pos: destination, range: options.range! },
      {
        maxOps: options.maxOps,
        maxRooms: options.maxRooms,
        plainCost: options.offRoad
          ? options.weightOffRoad || 1
          : options.ignoreRoads
          ? 1
          : 2,
        swampCost: options.offRoad
          ? options.weightOffRoad || 1
          : options.ignoreRoads
          ? 5
          : 10,
        roomCallback: callback,
      }
    );

    if (ret.incomplete && options.ensurePath) {
      if (options.useFindRoute === undefined) {
        // handle case where pathfinder failed at a short distance due to not using findRoute
        // can happen for situations where the creep would have to take an uncommonly indirect path
        // options.allowedRooms and options.routeCallback can also be used to handle this situation
        if (roomDistance <= 2) {
          console.log(
            `TRAVELER: path failed without findroute, trying with options.useFindRoute = true`
          );
          console.log(
            `from: ${origin.print}, destination: ${destination.print}`
          );
          options.useFindRoute = true;
          ret = this.findTravelPath(origin, destination, options);
          console.log(
            `TRAVELER: second attempt was ${
              ret.incomplete ? "not " : ""
            }successful`
          );
          return ret;
        }

        // TODO: handle case where a wall or some other obstacle is blocking the exit assumed by findRoute
      } // else {}
    }

    return ret;
  }

  /**
   * find a viable sequence of rooms that can be used to narrow down pathfinder's search algorithm
   * @param origin
   * @param destination
   * @param options
   * @returns {{}}
   */

  public static findRoute(
    origin: string,
    destination: string,
    options: TravelToOptions = {}
  ): { [roomName: string]: boolean } | void {
    const restrictDistance =
      options.restrictDistance ||
      Game.map.getRoomLinearDistance(origin, destination) + 10;
    const allowedRooms = { [origin]: true, [destination]: true };

    /*
    let highwayBias = 1;
    if (options.preferHighway) {
      highwayBias = 2.5;
      if (options.highwayBias) {
        highwayBias = options.highwayBias;
      }
    }
    */

    const ret = Game.map.findRoute(origin, destination, {
      routeCallback: (roomName: string) => {
        if (options.routeCallback) {
          const outcome = options.routeCallback(roomName);
          if (outcome !== undefined) {
            return outcome;
          }
        }

        const rangeToRoom = Game.map.getRoomLinearDistance(origin, roomName);
        if (rangeToRoom > restrictDistance) {
          // room is too far out of the way
          return Number.POSITIVE_INFINITY;
        }

        if (
          !options.allowHostile &&
          Traveler.checkAvoid(roomName) &&
          roomName !== destination &&
          roomName !== origin
        ) {
          // room is marked as "avoid" in room memory
          return Number.POSITIVE_INFINITY;
        }

        if (
          ["E33S24", "E36S23"].includes(roomName) &&
          roomName !== destination &&
          roomName !== origin
        )
          return Number.POSITIVE_INFINITY;

        /* if (roomInfo.dangerlvlmax === 8 && roomInfo.lastUpdated >= Game.time - CREEP_LIFE_TIME / 2)
          return 6; */
        /* if ([""].includes(roomName))
          return 1;*/

        const roomInfo = Apiary.intel.getInfo(roomName, Infinity);
        switch (roomInfo.roomState) {
          case roomStates.ownedByMe:
            return roomInfo.dangerlvlmax >= 6 && !options.ignoreCurrent ? 4 : 1;
          case roomStates.corridor:
          case roomStates.reservedByMe:
          case roomStates.noOwner:
          default:
            return roomInfo.dangerlvlmax >= 6 && !options.ignoreCurrent ? 8 : 1;
          case roomStates.SKfrontier:
          case roomStates.reservedByEnemy:
            return roomInfo.dangerlvlmax >= 4 && !options.ignoreCurrent ? 8 : 2;
          case roomStates.ownedByEnemy:
            return 255; // here never because of checkAvoid
        }
      },
    });

    if (!_.isArray(ret)) {
      console.log(`couldn't findRoute to ${destination}`);
      return;
    }
    for (const value of ret) {
      allowedRooms[value.room] = true;
    }

    return allowedRooms;
  }

  /**
   * check how many rooms were included in a route returned by findRoute
   * @param origin
   * @param destination
   * @returns {number}
   */

  public static routeDistance(
    origin: string,
    destination: string
  ): number | void {
    const linearDistance = Game.map.getRoomLinearDistance(origin, destination);
    if (linearDistance >= 32) return linearDistance;

    const allowedRooms = this.findRoute(origin, destination);
    if (allowedRooms) return Object.keys(allowedRooms).length;
  }

  /**
   * build a cost matrix based on structures in the room. Will be cached for more than one tick. Requires vision.
   * @param room
   * @param freshMatrix
   * @returns {any}
   */

  public static getStructureMatrix(
    room: Room,
    freshMatrix?: boolean
  ): CostMatrix {
    if (
      !this.structureMatrixCache[room.name] ||
      (freshMatrix && Game.time !== this.structureMatrixTick)
    ) {
      this.structureMatrixTick = Game.time;
      const matrix = new PathFinder.CostMatrix();
      this.structureMatrixCache[room.name] = Traveler.addStructuresToMatrix(
        room,
        matrix,
        1
      );
    }
    return this.structureMatrixCache[room.name];
  }

  /**
   * build a cost matrix based on creeps and structures in the room. Will be cached for one tick. Requires vision.
   * @param room
   * @returns {any}
   */

  public static getCreepMatrix(room: Room): CostMatrix {
    if (
      !this.creepMatrixCache[room.name] ||
      Game.time !== this.creepMatrixTick
    ) {
      this.creepMatrixTick = Game.time;
      this.creepMatrixCache[room.name] = Traveler.addCreepsToMatrix(
        room,
        this.getStructureMatrix(room, true).clone()
      );
    }
    return this.creepMatrixCache[room.name];
  }

  /**
   * add structures to matrix so that impassible structures can be avoided and roads given a lower cost
   * @param room
   * @param matrix
   * @param roadCost
   * @returns {CostMatrix}
   */

  public static addStructuresToMatrix(
    room: Room,
    matrix: CostMatrix,
    roadCost: number
  ): CostMatrix {
    const impassibleStructures: Structure[] = [];
    for (const structure of room.find(FIND_STRUCTURES)) {
      if (structure instanceof StructureRampart) {
        if (!structure.my && !structure.isPublic) {
          impassibleStructures.push(structure);
        }
      } else if (structure instanceof StructureRoad) {
        matrix.set(structure.pos.x, structure.pos.y, roadCost);
      } else if (structure instanceof StructureContainer) {
        matrix.set(structure.pos.x, structure.pos.y, 5);
      } else {
        impassibleStructures.push(structure);
      }
      /*
      else if (structure instanceof StructureKeeperLair && structure.ticksToSpawn && structure.ticksToSpawn < 30) {
        _.forEach(structure.pos.getOpenPositions(true, 3), p => matrix.set(p.x, p.y,
          Math.max(matrix.get(p.x, p.y), 4 * (4 - p.getRangeTo(structure)))));
        matrix.set(structure.pos.x, structure.pos.y, 0xff);
      }
      */
    }

    for (const site of room.find(FIND_MY_CONSTRUCTION_SITES)) {
      if (
        site.structureType === STRUCTURE_CONTAINER ||
        site.structureType === STRUCTURE_ROAD ||
        site.structureType === STRUCTURE_RAMPART
      ) {
        continue;
      }
      matrix.set(site.pos.x, site.pos.y, 0xff);
    }

    for (const structure of impassibleStructures) {
      matrix.set(structure.pos.x, structure.pos.y, 0xff);
    }

    return matrix;
  }

  /**
   * add creeps to matrix so that they will be avoided by other creeps
   * @param room
   * @param matrix
   * @returns {CostMatrix}
   */

  public static addCreepsToMatrix(room: Room, matrix: CostMatrix): CostMatrix {
    room
      .find(FIND_CREEPS)
      .forEach((creep: Creep) => matrix.set(creep.pos.x, creep.pos.y, 0xff));
    return matrix;
  }

  /**
   * serialize a path, traveler style. Returns a string of directions.
   * @param startPos
   * @param path
   * @param color
   * @returns {string}
   */

  public static serializePath(
    startPos: RoomPosition,
    path: RoomPosition[],
    color = "orange"
  ): string {
    let serializedPath = "";
    let lastPosition = startPos;
    this.circle(startPos, color);
    for (const position of path) {
      if (position.roomName === lastPosition.roomName) {
        if (VISUALS_TRAVELER)
          new RoomVisual(position.roomName).line(position, lastPosition, {
            color,
            lineStyle: "dashed",
          });
        serializedPath += lastPosition.getDirectionTo(position);
      }
      lastPosition = position;
    }
    return serializedPath;
  }

  /**
   * returns a position at a direction relative to origin
   * @param origin
   * @param direction
   * @returns {RoomPosition}
   */

  public static positionAtDirection(
    origin: RoomPosition,
    direction: number
  ): RoomPosition | void {
    const offsetX = [0, 0, 1, 1, 1, 0, -1, -1, -1];
    const offsetY = [0, -1, -1, 0, 1, 1, 1, 0, -1];
    const x = origin.x + offsetX[direction];
    const y = origin.y + offsetY[direction];
    if (x > 49 || x < 0 || y > 49 || y < 0) {
      return;
    }
    return new RoomPosition(x, y, origin.roomName);
  }

  /**
   * convert room avoidance memory from the old pattern to the one currently used
   * @param cleanup
   */

  private static deserializeState(
    travelData: TravelData,
    destination: RoomPosition
  ): TravelState {
    const state = {} as TravelState;
    if (travelData.state) {
      state.lastCoord = {
        x: travelData.state[STATE_PREV_X],
        y: travelData.state[STATE_PREV_Y],
      };
      state.cpu = travelData.state[STATE_CPU];
      state.stuckCount = travelData.state[STATE_STUCK];
      state.destination = new RoomPosition(
        travelData.state[STATE_DEST_X],
        travelData.state[STATE_DEST_Y],
        travelData.state[STATE_DEST_ROOMNAME]
      );
    } else {
      state.cpu = 0;
      state.destination = destination;
    }
    return state;
  }

  private static serializeState(
    creep: Creep | PowerCreep,
    destination: RoomPosition,
    state: TravelState,
    travelData: TravelData
  ) {
    travelData.state = [
      creep.pos.x,
      creep.pos.y,
      state.stuckCount,
      state.cpu,
      destination.x,
      destination.y,
      destination.roomName,
    ];
  }

  private static isStuck(
    creep: Creep | PowerCreep,
    state: TravelState
  ): boolean {
    let stuck = false;
    if (state.lastCoord !== undefined) {
      if (this.sameCoord(creep.pos, state.lastCoord)) {
        // didn't move
        stuck = true;
      } else if (this.isExit(creep.pos) && this.isExit(state.lastCoord)) {
        // moved against exit
        stuck = true;
      }
    }

    return stuck;
  }
}

// assigns a function to Creep.prototype: creep.travelTo(destination)
Creep.prototype.travelTo = function (
  destination: RoomPosition | { pos: RoomPosition },
  options?: TravelToOptions
) {
  return Traveler.travelTo(this, destination, options);
};

PowerCreep.prototype.travelTo = function (
  destination: RoomPosition | { pos: RoomPosition },
  options: TravelToOptions = {}
) {
  options.offRoad = true;
  return Traveler.travelTo(this, destination, options);
};
