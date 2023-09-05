import { ERR_INVALID_ACTION } from "static/constants";

import { PLANNER_COST } from "./addRoads";
import { surroundingPoints } from "./min-cut";
import type { RoomCellsPlanner, RoomPlannerMatrix } from "./planner-active";
import { PLANNER_STAMP_STOP } from "./planner-active";
import { addStructure } from "./planner-utils";
import type { Stamp } from "./stamps";

const MAX_ATTEMPTS_TO_ADD = 10000;

export function addStampSomewhere(
  prevCenters: Pos[],
  stamp: Stamp,
  ap: RoomPlannerMatrix,
  cells: RoomCellsPlanner
) {
  const strCheck = (p: Pos) => p.x + "_" + p.y;
  const visited: Set<string> = new Set(_.map(prevCenters, strCheck));
  const checkQue: Pos[] = [];
  // O(max(2500 * 2500, 2500 * stamp))
  const addPos = (p: Pos) => {
    if (ap.building.get(p.x, p.y) === PLANNER_COST.wall) return;
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
    if (canAddStamp(pos, stamp, ap) === OK) {
      addStamp(pos, stamp, ap);
      for (const [ref, val] of Object.entries(stamp.posCell)) cells[ref] = val;
      return pos;
    }
    _.forEach(surroundingPoints(pos), (p) => addPos(p));
  }
  return ERR_NOT_FOUND;
}

export function addStamp(
  centerOfStamp: Pos,
  stamp: Stamp,
  ap: RoomPlannerMatrix
) {
  const costMatrix = ap.building;

  const compressed = ap.compressed;
  for (const [sType, addPositions] of Object.entries(stamp.setup)) {
    const structureType = sType as BuildableStructureConstant;

    if (!compressed[structureType])
      compressed[structureType] = {
        que: [],
        len: 0,
      };

    let addedStructures = addPositions.length;

    for (const packedPos of addPositions) {
      const pos = unpackCoords(centerOfStamp, packedPos);
      let posStructureType = structureType;
      // add rampart instead of wall if on structure
      if (
        (costMatrix.get(pos.x, pos.y) === PLANNER_COST.road ||
          costMatrix.get(pos.x, pos.y) === PLANNER_COST.structure) &&
        isDefense(posStructureType)
      )
        posStructureType = STRUCTURE_RAMPART;

      addStructure(pos, posStructureType, ap);

      // if added not original structure (rampart instead of wall) record it
      if (structureType !== posStructureType) {
        compressed[posStructureType]!.que.push(PLANNER_STAMP_STOP);
        compressed[posStructureType]!.len += 1;
        --addedStructures;
      }
    }
    compressed[structureType]!.que.push(PLANNER_STAMP_STOP);
    compressed[structureType]!.len += addedStructures;
  }
  return OK;
}

export function canAddStamp(
  centerOfStamp: Pos,
  stamp: Stamp,
  ap: RoomPlannerMatrix
) {
  for (const [sType, addPositions] of Object.entries(stamp.setup)) {
    const structureType = sType as BuildableStructureConstant;
    for (const packedPos of addPositions) {
      const pos = unpackCoords(centerOfStamp, packedPos);
      if (pos.x <= 0 || pos.y <= 0 || pos.x >= 49 || pos.y >= 49)
        return ERR_INVALID_ACTION;

      const costOfMove = ap.building.get(pos.x, pos.y);
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

function isDefense(structureType: BuildableStructureConstant) {
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
