import { ERR_INVALID_ACTION } from "static/constants";

import { surroundingPoints } from "./min-cut";
import type { RoomCellsPlanner, RoomPlannerMatrix } from "./planner-active";
import { addStructure, PLANNER_COST } from "./planner-utils";
import type { Stamp } from "./stamps";

const MAX_ATTEMPTS_TO_ADD = 10000;

export function addStampSomewhere(
  prevCenters: Pos[],
  stamp: Stamp,
  roomMatrix: RoomPlannerMatrix,
  cells: RoomCellsPlanner,
  checkPrev = false
) {
  const strCheck = (p: Pos) => p.x + "_" + p.y;
  const visited: Set<string> = new Set(_.map(prevCenters, strCheck));
  let checkQue: Pos[] = [];
  if (checkPrev) checkQue = prevCenters.slice();
  // O(max(2500 * 2500, 2500 * stamp))
  const addPos = (p: Pos) => {
    if (roomMatrix.building.get(p.x, p.y) === PLANNER_COST.wall) return;
    if (visited.has(strCheck(p))) return;
    checkQue.push(p);
    visited.add(strCheck(p));
  };

  _.forEach(prevCenters, (pCenter) =>
    _.forEach(surroundingPoints(pCenter), addPos)
  );

  for (let i = 0; i < MAX_ATTEMPTS_TO_ADD; ++i) {
    const pos = checkQue.shift();
    if (!pos) break;
    if (canAddStamp(pos, stamp, roomMatrix) === OK) {
      addStamp(pos, stamp, roomMatrix);
      for (const [ref, val] of Object.entries(stamp.posCell)) {
        const coords = unpackCoords(pos, { x: val[0], y: val[1] });
        cells[ref] = [coords.x, coords.y];
      }
      return pos;
    }
    _.forEach(surroundingPoints(pos), (p) => addPos(p));
  }
  return ERR_NOT_FOUND;
}

function addStamp(
  centerOfStamp: Pos,
  stamp: Stamp,
  roomMatrix: RoomPlannerMatrix
) {
  const costMatrix = roomMatrix.building;
  const compressed = roomMatrix.compressed;

  for (const [sType, addPositions] of Object.entries(stamp.setup)) {
    const structureType = sType as keyof Stamp["setup"];

    const isNull = structureType === "null";

    if (!isNull && !compressed[structureType])
      compressed[structureType] = {
        que: [],
        len: 0,
      };

    for (const packedPos of addPositions) {
      const pos = unpackCoords(centerOfStamp, packedPos);

      if (isNull) {
        roomMatrix.building.set(pos.x, pos.y, PLANNER_COST.road);
        roomMatrix.movement.set(pos.x, pos.y, PLANNER_COST.road);
        continue;
      }

      let posStructureType = structureType;
      // add rampart instead of wall if on structure
      if (
        (costMatrix.get(pos.x, pos.y) === PLANNER_COST.road ||
          costMatrix.get(pos.x, pos.y) === PLANNER_COST.structure) &&
        isDefense(posStructureType)
      )
        posStructureType = STRUCTURE_RAMPART;

      addStructure(pos, posStructureType, roomMatrix);
    }
  }
  return OK;
}

export function canAddStamp(
  centerOfStamp: Pos,
  stamp: Stamp,
  roomMatrix: RoomPlannerMatrix
) {
  for (const [sType, addPositions] of Object.entries(stamp.setup)) {
    const structureType = sType as keyof Stamp["setup"];
    for (const packedPos of addPositions) {
      const pos = unpackCoords(centerOfStamp, packedPos);
      if (pos.x <= 0 || pos.y <= 0 || pos.x >= 49 || pos.y >= 49)
        return ERR_INVALID_ACTION;

      const costOfMove = roomMatrix.building.get(pos.x, pos.y);
      switch (costOfMove) {
        case PLANNER_COST.structure:
          if (isDefense(structureType)) break;
        // fall through
        case PLANNER_COST.wall:
          return ERR_INVALID_ACTION;
        case PLANNER_COST.road:
          if (structureType !== STRUCTURE_ROAD && !isDefense(structureType))
            return ERR_INVALID_ACTION;
          break;
        case PLANNER_COST.plain:
        case PLANNER_COST.swamp:
          break;
      }
    }
  }
  return OK;
}

function isDefense(structureType: keyof Stamp["setup"]) {
  return (
    structureType === STRUCTURE_WALL || structureType === STRUCTURE_CONTAINER
  );
}

function unpackCoords(
  centerOfStamp: Pos,
  pos: Pos,
  direction: 0 | 1 | 2 | 3 = 0, // rotation of center doesn't matter in the grad side of things?
  shiftY: number = 0,
  shiftX: number = 0
) {
  let x = pos.x - 25;
  let y = pos.y - 25;
  let temp;
  switch (direction) {
    case 1: // reverse
      x = -x;
      y = -y;
      break;
    case 2: // left
      temp = x;
      x = -y;
      y = temp;
      break;
    case 3: // right (clockwise)
      temp = x;
      x = y;
      y = -temp;
      break;
  }
  return {
    x: x + (centerOfStamp.x + shiftX),
    y: y + (centerOfStamp.y + shiftY),
  };
}
