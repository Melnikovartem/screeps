interface PathfinderReturn {
  path: RoomPosition[];
  ops: number;
  cost: number;
  incomplete: boolean;
}

interface TravelToReturnData {
  nextPos?: RoomPosition;
  pathfinderReturn?: PathfinderReturn;
  state?: TravelState;
  path?: string;
}

interface TravelToOptions {
  ignoreRoads?: boolean;
  ignoreCreeps?: boolean;
  ignoreStructures?: boolean;
  allowHostile?: boolean;
  range?: number;
  obstacles?: { pos: RoomPosition }[];
  roomCallback?: (
    roomName: string,
    matrix: CostMatrix
  ) => CostMatrix | boolean | undefined;
  routeCallback?: (roomName: string) => number;
  returnData?: TravelToReturnData;
  restrictDistance?: number;
  useFindRoute?: boolean;
  maxOps?: number;
  movingTarget?: boolean;
  freshMatrix?: boolean;
  offRoad?: boolean;
  stuckValue?: number;
  maxRooms?: number;
  repath?: number;
  route?: { [roomName: string]: boolean };
  ensurePath?: boolean;
  // mine
  weightOffRoad?: number;
  ignoreCurrent?: boolean;
  flee?: boolean;
}

interface TravelData {
  state: any[];
  path?: string;
}

interface TravelState {
  stuckCount: number;
  lastCoord: Coord;
  destination: RoomPosition;
  cpu: number;
}

interface Creep {
  travelTo(
    destination: HasPos | RoomPosition,
    ops?: TravelToOptions
  ): ScreepsReturnCode | RoomPosition;
}

interface PowerCreep {
  travelTo(
    destination: HasPos | RoomPosition,
    ops?: TravelToOptions
  ): ScreepsReturnCode | RoomPosition;
}

interface Coord {
  x: number;
  y: number;
}
interface HasPos {
  pos: RoomPosition;
}
