import type { FnEngine } from "engine";
import type { Hive } from "hive/hive";
import type { HiveCells } from "hive/hive-declarations";
import { ERR_NO_VISION } from "static/constants";
import { prefix, roomStates } from "static/enums";

import { initMatrix } from "./addRoads";
import { addStructure, PLANNER_STAMP_STOP } from "./planner-utils";
import type { RoomPlanner } from "./roomPlanner";

type CompressedStructures = ([number, number] | typeof PLANNER_STAMP_STOP)[];
export interface RoomPlannerMatrix {
  compressed: {
    [tt in BuildableStructureConstant]?: {
      que: CompressedStructures;
      len: number;
    };
  };
  /** doesn't allow near resources and controller */
  building: CostMatrix;
  /** can move the fuck you want */
  movement: CostMatrix;
  free: CostMatrix;
}

export interface RoomCellsPlanner {
  [ref: string]: [number, number];
}
interface PlannerMetrics {
  /** number of ramps */
  ramps: number;
  /** minDmg in absolute value */
  minDmg: number;
  sumRoadTower: number;
  sumRoadExt: number;
  sumRoadRes: number;
  roadLabs: number;
  roadFastRef: number;
  final: number;
}

export const PLANNER_EMPTY_METRICS: PlannerMetrics = {
  ramps: 0,
  minDmg: 0,
  sumRoadTower: 0,
  sumRoadExt: 0,
  sumRoadRes: 0,
  roadLabs: 0,
  roadFastRef: 0,
  final: 0,
};

export interface ActivePlan {
  // #region Properties (5)

  // exits: RoomPosition[];
  // jobsToDo: Tasks[]; // ERR_BUSY - repeat job, ERR_FULL - failed
  // correct: "ok" | "fail" | "work";
  // resources to add to plan

  posCell: RoomCellsPlanner;
  rooms: {
    [id: string]: RoomPlannerMatrix;
  };
  centers: Pos[]; // first is always pos
  metrics: PlannerMetrics;

  // #endregion Properties (5)
  // controller of room
}

export type CompressedRoom = {
  [tt in BuildableStructureConstant]?: CompressedStructures;
};
export interface RoomPlannerHiveCache {
  posCell: ActivePlan["posCell"];
  rooms: {
    [roomName: string]: CompressedRoom;
  };
  metrics: ActivePlan["metrics"];
}

export function savePlan(this: RoomPlanner) {
  if (!this.checking) return ERR_NOT_FOUND;
  const bp = this.checking.best;
  // show / allow to modify best plan
  this.checking.active = bp;
  const mem = Memory.longterm.roomPlanner;
  const hiveName = this.checking.roomName;

  mem[hiveName] = {
    posCell: bp.posCell,
    metrics: bp.metrics,
    rooms: {},
  };

  _.forEach(bp.rooms, (schematic, roomName) => {
    const ref = roomName || "NaN";
    mem[hiveName].rooms[ref] = {};
    _.forEach(schematic.compressed, (buildInfo, sType) => {
      // should be always with PLANNER_STAMP_STOP
      const lastBlockEnd =
        buildInfo.que[buildInfo.que.length - 1] === PLANNER_STAMP_STOP ? 1 : 0;
      mem[hiveName].rooms[ref][sType as BuildableStructureConstant] =
        buildInfo.que.slice(0, buildInfo.que.length - lastBlockEnd);
    });
  });

  // update actual hive
  const hiveMemory = Memory.cache.hives[hiveName];
  const hive = Apiary.hives[hiveName] as Hive | undefined;
  for (const [refString, possPlan] of Object.entries(bp.posCell)) {
    const ref = refString as keyof HiveCells;
    const poss = { x: possPlan[0], y: possPlan[1] };
    const cell = hive && hive.cells[ref];
    if (cell && "poss" in cell) cell.poss = poss;
  }
  // update memory
  for (const [ref, poss] of Object.entries(bp.posCell)) {
    if (!hiveMemory.cells[ref]) hiveMemory.cells[ref] = {};
    hiveMemory.cells[ref].poss = { x: poss[0], y: poss[1] };
  }
  return OK;
}

export function parseInitPlan(
  this: RoomPlanner,
  hiveName: string,
  annexNames: string[],
  payload: FnEngine | undefined
): ReturnType<FnEngine> {
  const ans = this.parseRoomInternal(hiveName, annexNames);
  if (ans === ERR_NO_VISION)
    return {
      f: () => this.parseInitPlan(hiveName, annexNames, payload),
      ac: Game.time + 10,
    }; // no vision try again
  if (ans !== OK) return undefined; // smth broke end
  return {
    // finished so we go on
    f: () => {
      if (!this.parsingRooms) return undefined;
      const pr = this.parsingRooms;
      this.initPlan(hiveName, pr.controller, pr.sources, pr.minerals);
      this.parsingRooms = undefined;
      return payload && { f: payload };
    },
  };
}

/** parses rooms until all in this.parsingRoom
 *
 * payload is returned when finished
 *
 * ERR_NO_VISION if no vision
 *
 * other mistakes if error
 *
 * OK if no payload
 */
export function parseRoomInternal(
  this: RoomPlanner,
  hiveName: string,
  annexNames: string[]
) {
  if (!this.parsingRooms || this.parsingRooms.roomName !== hiveName) {
    const room = Game.rooms[hiveName];
    if (!room) return ERR_NO_VISION;
    const posCont = room.controller?.pos;
    if (!posCont) return ERR_INVALID_TARGET;
    this.parsingRooms = {
      roomName: hiveName,
      rooms: [hiveName].concat(annexNames),
      sources: [],
      minerals: [],
      controller: posCont,
    };
  }

  const pr = this.parsingRooms;

  for (const roomName of this.parsingRooms.rooms) {
    const state = Apiary.intel.getRoomState(roomName);
    switch (state) {
      case roomStates.ownedByMe:
      case roomStates.reservedByMe:
      case roomStates.noOwner:
      case roomStates.reservedByInvader:
      case roomStates.SKfrontier:
      case roomStates.SKcentral:
        if (!pr.sources.filter((p) => p.roomName === roomName).length) break;
      // fall through
      default:
        continue;
    }
    const room = Game.rooms[roomName];
    if (!room) {
      Apiary.oracle.requestSight(roomName);
      return ERR_NO_VISION;
    }

    const sourcesPos = room.find(FIND_SOURCES).map((r) => r.pos);
    let mineralsPos: RoomPosition[] = [];
    if (
      [
        roomStates.ownedByMe,
        roomStates.SKcentral,
        roomStates.SKfrontier,
      ].includes(state)
    )
      mineralsPos = room.find(FIND_MINERALS).map((r) => r.pos);

    pr.sources = pr.sources.concat(sourcesPos);
    pr.minerals = pr.minerals.concat(mineralsPos);
  }

  return OK;
}

export function fromCache(this: RoomPlanner, hiveName: string) {
  if (!this.checking) return ERR_NOT_FOUND;
  const mem = Memory.longterm.roomPlanner[hiveName];
  if (!mem) return ERR_NOT_FOUND;

  const mainPos = mem.posCell[prefix.defenseCell];
  console.log("3 fromCache", mainPos);
  if (!mainPos) return ERR_NOT_FOUND;
  const ch = this.checking;
  ch.positions = [new RoomPosition(mainPos[0], mainPos[1], ch.roomName)];
  ch.best.posCell = _.cloneDeep(mem.posCell);
  ch.best.metrics = _.cloneDeep(mem.metrics);

  _.forEach(mem.rooms, (roomPlan, roomName) => {
    if (!roomName) return;
    ch.best.rooms[roomName] = initMatrix(roomName);

    _.forEach(roomPlan, (buildInfo, sType) => {
      const structureType = sType as BuildableStructureConstant;
      _.forEach(buildInfo, (b) => {
        if (b !== PLANNER_STAMP_STOP)
          addStructure(
            { x: b[0], y: b[1] },
            structureType,
            ch.best.rooms[roomName]
          );
      });
    });
  });
  ch.active = ch.best;
  return OK;
}
