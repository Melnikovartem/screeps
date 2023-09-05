import { ERR_INVALID_ACTION } from "static/constants";

import { PLANNER_STAMP_STOP } from "./plannerActive";
import { PLANNER_COST, type RoomPlanner } from "./roomPlanner";
import type { Stamp } from "./stamps";

export function addStamp(
  this: RoomPlanner,
  centerOfStamp: RoomPosition,
  stamp: Stamp
) {
  if (!this.activePlanning) return ERR_NOT_FOUND;
  const roomName = centerOfStamp.roomName;
  const ap = this.activePlanning;
  if (!ap.compressed[roomName]) ap.compressed[roomName] = {};
  if (!ap.movement[roomName])
    ap.movement[roomName] = this.getTerrainCostMatrix(roomName);
  const compressed = ap.compressed[roomName];
  const costMatrix = ap.movement[roomName];
  for (const [sType, addPositions] of Object.entries(stamp.setup)) {
    const structureType = sType as BuildableStructureConstant;

    if (!compressed[structureType])
      compressed[structureType] = {
        que: [],
        len: 0,
      };

    let costOfMove = PLANNER_COST.structure;
    if (structureType === STRUCTURE_ROAD) costOfMove = PLANNER_COST.road;
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

      if (!compressed[posStructureType])
        compressed[posStructureType] = {
          que: [],
          len: 0,
        };
      compressed[posStructureType]!.que.push([pos.x, pos.y]);

      // add new movement cost
      if (posStructureType !== STRUCTURE_RAMPART)
        this.activePlanning.movement[centerOfStamp.roomName].set(
          pos.x,
          pos.y,
          costOfMove
        );

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
  this: RoomPlanner,
  centerOfStamp: RoomPosition,
  stamp: Stamp
) {
  if (!this.activePlanning) return ERR_NOT_FOUND;
  for (const [sType, addPositions] of Object.entries(stamp.setup)) {
    const structureType = sType as BuildableStructureConstant;
    for (const packedPos of addPositions) {
      const pos = unpackCoords(centerOfStamp, packedPos);

      const roomName = centerOfStamp.roomName;
      const apM = this.activePlanning.movement;
      if (!apM[roomName]) apM[roomName] = this.getTerrainCostMatrix(roomName);

      const costOfMove = apM[roomName].get(pos.x, pos.y);
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
  centerOfStamp: RoomPosition,
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
