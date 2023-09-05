import { PLANNER_COST } from "./addRoads";
import type { RoomPlannerMatrix } from "./planner-active";

/** kinda heavy cause we check all prev, but for roads is required and for ramps ... we can bear it */
export function addStructure(
  pos: Pos,
  structureType: BuildableStructureConstant,
  ap: RoomPlannerMatrix
) {
  let costOfMove = PLANNER_COST.structure;
  if (structureType === STRUCTURE_ROAD) costOfMove = PLANNER_COST.road;

  if (!ap.compressed[structureType])
    ap.compressed[structureType] = {
      que: [],
      len: 0,
    };
  ap.compressed[structureType]!.que.push([pos.x, pos.y]);

  // add new movement cost
  if (structureType !== STRUCTURE_RAMPART) {
    ap.movement.set(pos.x, pos.y, costOfMove);
    ap.building.set(pos.x, pos.y, costOfMove);
  }
}
