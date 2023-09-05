import type { PLANNER_STAMP_STOP } from "./planner-utils";
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
}

export interface RoomCellsPlanner {
  [ref: string]: [number, number, string?];
}

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
}

export function saveActive(this: RoomPlanner) {
  if (!this.checking) return ERR_NOT_FOUND;

  Memory.longterm.roomPlanner;
  return OK;
}
