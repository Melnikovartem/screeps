import type { RoomPlanner } from "./roomPlanner";

export const PLANNER_STAMP_STOP = "#";

type CompressedStructures = ([number, number] | typeof PLANNER_STAMP_STOP)[];
export interface ActivePlan {
  // #region Properties (5)

  // exits: RoomPosition[];
  // jobsToDo: Tasks[]; // ERR_BUSY - repeat job, ERR_FULL - failed
  // correct: "ok" | "fail" | "work";
  // resources to add to plan

  futureHiveName: string;
  controller: RoomPosition;
  sources: RoomPosition[];
  minerals: RoomPosition[];
  movement: {
    [roomName: string]: CostMatrix;
  };
  posCell: { [ref: string]: [number, number, string?] };
  compressed: {
    [roomName: string]: {
      [tt in BuildableStructureConstant]?: {
        que: CompressedStructures;
        len: number;
      };
    };
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
  if (!this.activePlanning) return ERR_NOT_FOUND;

  Memory.longterm.roomPlanner;
  return OK;
}
