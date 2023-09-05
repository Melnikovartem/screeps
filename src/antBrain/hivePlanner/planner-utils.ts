import type { ActivePlan, RoomPlannerMatrix } from "./planner-active";

export const PLANNER_STAMP_STOP = "#";

export const PLANNER_COST = {
  road: 1,
  plain: 2,
  swamp: 10,
  structure: 255, // not rly an option
  wall: 255, // not rly an option
};

/** kinda heavy cause we check all prev, but for roads is required and for ramps ... we can bear it */
export function addStructure(
  pos: Pos,
  structureType: BuildableStructureConstant,
  ap: RoomPlannerMatrix
) {
  if (!ap.compressed[structureType])
    ap.compressed[structureType] = {
      que: [],
      len: 0,
    };
  if (
    ap.compressed[structureType]!.len >= CONTROLLER_STRUCTURES[structureType][8]
  )
    return ERR_FULL;

  let costOfMove = PLANNER_COST.structure;
  if (structureType === STRUCTURE_ROAD) costOfMove = PLANNER_COST.road;
  ap.compressed[structureType]!.que.push([pos.x, pos.y]);

  // if non walkable structure
  if (
    structureType !== STRUCTURE_RAMPART &&
    structureType !== STRUCTURE_CONTAINER
  ) {
    // add new movement cost
    ap.movement.set(pos.x, pos.y, costOfMove);
    if (ap.building.get(pos.x, pos.y) !== PLANNER_COST.structure)
      ap.building.set(pos.x, pos.y, costOfMove);
  }
  return OK;
}

export function addContainer(
  resPos: RoomPosition,
  ap: RoomPlannerMatrix,
  distTo: RoomPosition
) {
  let points = _.filter(
    resPos.getOpenPositions(),
    (p) => ap.movement.get(p.x, p.y) !== PLANNER_COST.structure
  );
  if (!points.length) return ERR_NOT_FOUND;
  const pointsWithR = _.filter(
    points,
    (p) => ap.movement.get(p.x, p.y) === PLANNER_COST.road
  );
  if (pointsWithR.length) points = pointsWithR;
  // replace one road with container for mining
  const pos = points.reduce((a, b) =>
    distTo.getRangeApprox(a) < distTo.getRangeApprox(b) ? a : b
  );
  if (ap.compressed[STRUCTURE_ROAD] && pointsWithR.length) {
    let removed = 0;
    ap.compressed[STRUCTURE_ROAD].que = _.filter(
      ap.compressed[STRUCTURE_ROAD].que,
      (p) => {
        if (p === PLANNER_STAMP_STOP) return true;
        if (p[0] !== pos.x || p[1] !== pos.y) return true;
        ++removed;
        return false;
      }
    );
    ap.compressed[STRUCTURE_ROAD].len -= removed;
  }
  addStructure(pos, STRUCTURE_CONTAINER, ap);
  return pos;
}

export function addLink(
  resPos: RoomPosition,
  ap: RoomPlannerMatrix,
  distTo: RoomPosition,
  range = 2
) {
  const points = _.filter(
    resPos.getOpenPositions(false, range),
    (p) =>
      resPos.getRangeTo(p) === range &&
      (ap.movement.get(p.x, p.y) === PLANNER_COST.plain ||
        ap.movement.get(p.x, p.y) === PLANNER_COST.swamp)
  );
  if (!points.length) return ERR_NOT_FOUND;
  // replace one road with link
  const pos = points.reduce((a, b) =>
    distTo.getRangeApprox(a) < distTo.getRangeApprox(b) ? a : b
  );
  addStructure(pos, STRUCTURE_LINK, ap);
  return pos;
}

export function endBlock(ap: ActivePlan, sType?: BuildableStructureConstant) {
  for (const roomName of Object.keys(ap.rooms)) {
    endBlockRoom(ap.rooms[roomName], sType);
  }
}

function endBlockRoom(
  ap: RoomPlannerMatrix,
  sType?: BuildableStructureConstant
) {
  for (const sTypeIter of Object.keys(ap.compressed)) {
    const structureType = sTypeIter as BuildableStructureConstant;
    if (sType && sType !== structureType) continue;
    const que = ap.compressed[structureType]!.que;
    let toAdd = 0;
    for (let i = que.length - 1; i >= 0; --i)
      if (que[i] === PLANNER_STAMP_STOP) break;
      else ++toAdd;
    if (que[que.length - 1] !== PLANNER_STAMP_STOP)
      que.push(PLANNER_STAMP_STOP);
    ap.compressed[structureType]!.len += toAdd;
  }
}
