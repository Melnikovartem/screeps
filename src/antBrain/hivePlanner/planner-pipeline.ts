import { findCoordsInsideRect } from "static/utils";

import { addRoad, initMatrix } from "./addRoads";
import { addStamp, addStampSomewhere, canAddStamp } from "./addStamps";
import { minCutToExit } from "./min-cut";
import {
  addContainer,
  addLink,
  addStructure,
  endBlock,
  PLANNER_COST,
} from "./planner-utils";
import type { PlannerChecking } from "./roomPlanner";
import {
  STAMP_CORE,
  STAMP_EXTENSION_BLOCK,
  STAMP_FAST_REFILL,
  STAMP_LABS,
  STAMP_OBSERVE,
  STAMP_POWER,
} from "./stamps";

type plannerStep = (ch: PlannerChecking) => OK | ERR_FULL;

const PLANNER_PADDING = {
  resource: 1,
  controller: 2,
};

export const PLANNER_STEPS: plannerStep[] = [
  innitActive,
  addMainStamps,
  addExtentions,
  addPowerObserve,
  addWalls,
  addController,
  addResources,
];

function innitActive(ch: PlannerChecking) {
  const posIter = ch.positions.shift();
  if (!posIter) return ERR_FULL;
  const pos = new RoomPosition(posIter[0].x, posIter[0].y, ch.roomName);
  ch.active = {
    posCell: {},
    rooms: { [ch.roomName]: initMatrix(ch.roomName) },
    centers: [pos],
  };

  const ap = ch.active;

  _.forEach(
    findCoordsInsideRect(
      ch.controller.x - PLANNER_PADDING.controller,
      ch.controller.y - PLANNER_PADDING.controller,
      ch.controller.x + PLANNER_PADDING.controller,
      ch.controller.y + PLANNER_PADDING.controller
    ),
    (p) =>
      ch.active.rooms[ch.roomName].building.set(p.x, p.y, PLANNER_COST.wall)
  );
  _.forEach(ch.sources.concat(ch.minerals), (res) => {
    _.forEach(
      findCoordsInsideRect(
        res.x - PLANNER_PADDING.resource,
        res.y - PLANNER_PADDING.resource,
        res.x + PLANNER_PADDING.resource,
        res.y + PLANNER_PADDING.resource
      ),
      (p) => {
        if (!ap.rooms[res.roomName])
          ap.rooms[res.roomName] = initMatrix(res.roomName);
        ap.rooms[res.roomName].building.set(p.x, p.y, PLANNER_COST.wall);
      }
    );
  });

  ch.sources.sort((a, b) => pos.getRangeApprox(a) - pos.getRangeApprox(b));
  ch.minerals.sort((a, b) => pos.getRangeApprox(a) - pos.getRangeApprox(b));

  return OK;
}

function addMainStamps(ch: PlannerChecking) {
  const roomMatrix = ch.active.rooms[ch.roomName];
  const pos = getPos(ch);

  // add main stamp - core
  if (canAddStamp(pos, STAMP_CORE, roomMatrix) !== OK) return ERR_FULL;
  addStamp(pos, STAMP_CORE, roomMatrix);

  // add stamp lab
  const lab = addStampSomewhere(
    [pos],
    STAMP_LABS,
    roomMatrix,
    ch.active.posCell
  );
  if (lab === ERR_NOT_FOUND) return ERR_FULL;
  // add stamp fastrefill
  const fastRef = addStampSomewhere(
    [pos, lab],
    STAMP_FAST_REFILL,
    roomMatrix,
    ch.active.posCell
  );
  if (fastRef === ERR_NOT_FOUND) return ERR_FULL;

  addRoad(pos, lab, ch.active);
  addRoad(pos, fastRef, ch.active, 3);
  addRoad(new RoomPosition(lab.x, lab.y, ch.roomName), fastRef, ch.active, 3);

  ch.active.centers.push(lab);
  ch.active.centers.push(fastRef);
  return OK;
}

function addExtentions(ch: PlannerChecking) {
  const pos = getPos(ch);
  // (60 - 14) / 5 = 8.8
  for (let i = 0; i < 9; ++i) {
    const extentionPos = addStampSomewhere(
      ch.active.centers,
      STAMP_EXTENSION_BLOCK,
      ch.active.rooms[ch.roomName],
      ch.active.posCell
    );
    if (extentionPos === ERR_NOT_FOUND) return ERR_FULL;
    ch.active.centers.push(extentionPos);
    addRoad(pos, extentionPos, ch.active);
  }
  return OK;
}

function getPos(ch: PlannerChecking) {
  return new RoomPosition(
    ch.active.centers[0].x,
    ch.active.centers[0].y,
    ch.roomName
  );
}

function addPowerObserve(ch: PlannerChecking) {
  const pos = getPos(ch);
  const ceneters = ch.active.centers.slice();
  ceneters.reverse();
  const power = addStampSomewhere(
    ceneters,
    STAMP_POWER,
    ch.active.rooms[ch.roomName],
    ch.active.posCell
  );
  if (power === ERR_NOT_FOUND) return ERR_FULL;
  addRoad(pos, power, ch.active);
  addStampSomewhere(
    ceneters,
    STAMP_OBSERVE,
    ch.active.rooms[ch.roomName],
    ch.active.posCell
  );
  return OK;
}

function addWalls(ch: PlannerChecking) {
  const costMatrix = initMatrix(ch.roomName).movement;
  const roomMatrix = ch.active.rooms[ch.roomName];

  const posToProtect: Pos[] = [];
  const addedPos: Set<string> = new Set();
  for (let x = 0; x < 50; ++x)
    for (let y = 0; y < 50; ++y)
      if (
        roomMatrix.movement.get(x, y) === PLANNER_COST.structure &&
        costMatrix.get(x, y) !== PLANNER_COST.structure
      )
        _.forEach(
          new RoomPosition(x, y, ch.roomName).getOpenPositions(false, 3),
          (p) => {
            if (!addedPos.has(p.to_str)) {
              addedPos.add(p.to_str);
              posToProtect.push(p);
            }
          }
        );

  const ramps = minCutToExit(posToProtect, costMatrix);

  // adding walls themselves
  _.forEach(ramps, (ramp) => {
    addStructure(
      new RoomPosition(ramp.x, ramp.y, ch.roomName),
      STRUCTURE_RAMPART,
      roomMatrix
    );
    // should add roads to walls?
  });
  return OK;
}

function addController(ch: PlannerChecking) {
  const pos = getPos(ch);
  const posContrLink = addLink(
    ch.controller,
    ch.active.rooms[ch.roomName],
    pos
  );
  if (posContrLink === ERR_NOT_FOUND) return ERR_FULL;
  if (addRoad(pos, posContrLink, ch.active) === ERR_NOT_IN_RANGE)
    return ERR_FULL;
  return OK;
}

function addResources(ch: PlannerChecking) {
  const pos = getPos(ch);
  const roomMatrix = ch.active.rooms[ch.roomName];

  for (const resPos of ch.sources) {
    if (addRoad(pos, resPos, ch.active) !== OK) return ERR_FULL;
    const containerPos = addContainer(
      resPos,
      ch.active.rooms[resPos.roomName],
      pos
    );
    if (containerPos === ERR_NOT_FOUND) return ERR_FULL;
    if (
      ch.roomName === resPos.roomName &&
      addLink(containerPos, roomMatrix, pos, 1) === ERR_NOT_FOUND
    )
      return ERR_FULL;
    endBlock(ch.active, STRUCTURE_ROAD);
  }
  endBlock(ch.active);

  for (const resPos of ch.minerals) {
    if (addRoad(pos, resPos, ch.active) !== OK) return ERR_FULL;
    const containerPos = addContainer(
      resPos,
      ch.active.rooms[resPos.roomName],
      pos
    );
    if (containerPos === ERR_NOT_FOUND) return ERR_FULL;
    if (ch.roomName === resPos.roomName)
      addStructure(resPos, STRUCTURE_EXTRACTOR, roomMatrix);
    endBlock(ch.active);
  }
  return OK;
}
