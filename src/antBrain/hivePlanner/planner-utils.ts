import { towerCoef } from "static/utils";

import type { ActivePlan, RoomPlannerMatrix } from "./planner-active";
import type { PlannerChecking, RoomPlanner } from "./roomPlanner";

export const PLANNER_TOWERS = CONTROLLER_STRUCTURES[STRUCTURE_TOWER][8];

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
  if (pos.x <= 0 || pos.y <= 0 || pos.x >= 49 || pos.y >= 49)
    return ERR_INVALID_ARGS;

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
  ++ap.compressed[structureType]!.len;

  // if non walkable structure
  if (structureType !== STRUCTURE_RAMPART) {
    // add new movement cost
    // dont want to build on containers:
    // if (structureType !== STRUCTURE_CONTAINER)
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
  range = 2,
  maxFree = true
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
  const pos = points.reduce((a, b) => {
    let diff = maxFree
      ? b.getOpenPositions().length - a.getOpenPositions().length
      : 0;
    if (diff === 0) diff = distTo.getRangeApprox(a) - distTo.getRangeApprox(b);
    return diff <= 0 ? a : b;
  });
  addStructure(pos, STRUCTURE_LINK, ap);
  return pos;
}

export function endBlock(ap: ActivePlan, sType?: BuildableStructureConstant) {
  for (const roomName of Object.keys(ap.rooms)) {
    endBlockRoom(ap.rooms[roomName], sType);
  }
}

function endBlockRoom(
  roomMatrix: RoomPlannerMatrix,
  sType?: BuildableStructureConstant
) {
  for (const sTypeIter of Object.keys(roomMatrix.compressed)) {
    const structureType = sTypeIter as BuildableStructureConstant;
    if (sType && sType !== structureType) continue;
    const que = roomMatrix.compressed[structureType]!.que;
    if (que[que.length - 1] !== PLANNER_STAMP_STOP)
      que.push(PLANNER_STAMP_STOP);
  }
}

export function emptySpot(
  this: RoomPlanner,
  pos: { x: number; y: number; roomName: string }
) {
  if (!this.checking) return;
  const roomMatrix = this.checking.active.rooms[pos.roomName];
  for (const sType of Object.keys(roomMatrix.compressed)) {
    const sInfo = roomMatrix.compressed[sType as BuildableStructureConstant]!;
    sInfo.que = sInfo.que.filter(
      (p) => p === PLANNER_STAMP_STOP || p[0] !== pos.x || p[1] !== pos.y
    );
    sInfo.len = sInfo.que.filter((p) => p !== PLANNER_STAMP_STOP).length;
  }
}

export function getPos(ch: PlannerChecking) {
  return new RoomPosition(
    ch.active.centers[0].x,
    ch.active.centers[0].y,
    ch.roomName
  );
}

export function calcTowerDmg(
  roomMatrix: RoomPlannerMatrix,
  roomName: string
): [RoomPosition[], { [pos: string]: number }] {
  // could ignore roomName with W0N0, but decided not to
  const wallsDmg: { [pos: string]: number } = {};
  const allWalls = _.map(
    _.filter(
      (roomMatrix.compressed[STRUCTURE_RAMPART]?.que || []).concat(
        roomMatrix.compressed[STRUCTURE_WALL]?.que || []
      ),
      (w) => w !== PLANNER_STAMP_STOP
    ) as [number, number][],
    (p) => new RoomPosition(p[0], p[1], roomName)
  );

  _.forEach(allWalls, (val) => (wallsDmg[val.to_str] = 0));
  _.forEach(roomMatrix.compressed[STRUCTURE_TOWER]?.que || [], (towerPos) => {
    if (towerPos !== PLANNER_STAMP_STOP)
      _.forEach(
        allWalls,
        (val) =>
          (wallsDmg[val.to_str] +=
            towerCoef(
              { pos: new RoomPosition(towerPos[0], towerPos[1], roomName) },
              val
            ) * TOWER_POWER_ATTACK)
      );
  });
  return [allWalls, wallsDmg];
}
