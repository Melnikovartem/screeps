import type { RoomPlanner } from "./roomPlanner";

export interface ActivePlan {
  // #region Properties (5)

  // exits: RoomPosition[];
  // jobsToDo: Tasks[]; // ERR_BUSY - repeat job, ERR_FULL - failed
  // correct: "ok" | "fail" | "work";
  // resources to add to plan

  controller: RoomPosition[];
  resources: RoomPosition[];
  moveMent: {
    [roomName: string]: CostMatrix;
  };
  posCache: { [ref: number]: [number, number, string?] };
  compressed: {
    [roomName: string]: {
      [tt in BuildableStructureConstant]: {
        que: ([number, number] | "#")[];
        len: number;
      };
    };
  };

  // #endregion Properties (5)
  // controller of room
}

export interface RoomPlannerHiveCache {}

export function saveActive(this: RoomPlanner) {
  if (!this.activePlanning) return ERR_NOT_FOUND;

  Memory.longterm.roomPlanner[this];
}
