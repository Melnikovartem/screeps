import type { Hive } from "hive/hive";
import type { HiveCells } from "hive/hive-declarations";

import { PLANNER_STAMP_STOP } from "./planner-utils";
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

export interface RoomPlannerHiveCache {
  posCell: ActivePlan["posCell"];
  rooms: {
    [roomName: string]: {
      [tt in BuildableStructureConstant]?: CompressedStructures;
    };
  };
  metrics: ActivePlan["metrics"];
}

export function savePlan(this: RoomPlanner) {
  if (!this.checking) return ERR_NOT_FOUND;
  const bp = this.checking.best;
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
    if (!hiveMemory.cells[ref] || true) hiveMemory.cells[ref] = {};
    hiveMemory.cells[ref].poss = { x: poss[0], y: poss[1] };
  }
  return OK;
}

export function fromCache(this: RoomPlanner, roomName: string) {
  this.createPlan(roomName, false);
}
