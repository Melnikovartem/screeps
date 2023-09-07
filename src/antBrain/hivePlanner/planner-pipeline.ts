import { prefix } from "static/enums";
import { findCoordsInsideRect } from "static/utils";

import { addRoad, initMatrix } from "./addRoads";
import { addStampSomewhere, canAddStamp } from "./addStamps";
import { minCutToExit, surroundingPoints } from "./min-cut";
import { PLANNER_EMPTY_METRICS } from "./planner-active";
import { addTowers, PLANNER_FREE_MATRIX } from "./planner-towers";
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
  STAMP_REST,
} from "./stamps";

type plannerStep = (ch: PlannerChecking) => OK | ERR_FULL;

const PLANNER_PADDING = {
  resource: 1,
  controller: 2,
};

export const PLANNER_EXTENSION = Math.ceil(
  CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][8] / 5 - 3
);

const PLANNER_REST_COEF = {
  annex: 0.2,
  minerals: 2,
  center: 4,
};

export const PLANNER_STEPS: plannerStep[] = [
  innitActive,
  addMainStamps,
  addExtentions,
  addPowerObserve,
  addWalls,
  addController,
  addResources,
  addTowers,
  addRestPos,
  finalDefenses,
];

function innitActive(ch: PlannerChecking) {
  const posIter = ch.positions.shift();
  if (!posIter) return ERR_FULL;
  const pos = new RoomPosition(posIter[0].x, posIter[0].y, ch.roomName);
  ch.active = {
    centers: [pos],
    posCell: {},
    rooms: { [ch.roomName]: initMatrix(ch.roomName) },
    metrics: { ...PLANNER_EMPTY_METRICS },
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
  addStampSomewhere([pos], STAMP_CORE, roomMatrix, ch.active.posCell, true);

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

  ch.active.metrics.roadLabs = addRoad(pos, lab, ch.active)[1];
  ch.active.metrics.roadFastRef = addRoad(pos, fastRef, ch.active, 3)[1];
  addRoad(new RoomPosition(lab.x, lab.y, ch.roomName), fastRef, ch.active, 3);

  ch.active.centers.push(lab);
  ch.active.centers.push(fastRef);
  return OK;
}

function addExtentions(ch: PlannerChecking) {
  const pos = getPos(ch);
  ch.active.metrics.sumRoadExt = 0;
  for (let i = 0; i < PLANNER_EXTENSION; ++i) {
    const extentionPos = addStampSomewhere(
      ch.active.centers,
      STAMP_EXTENSION_BLOCK,
      ch.active.rooms[ch.roomName],
      ch.active.posCell
    );
    if (extentionPos === ERR_NOT_FOUND) return ERR_FULL;
    ch.active.centers.push(extentionPos);
    ch.active.metrics.sumRoadExt += addRoad(pos, extentionPos, ch.active)[1];
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
  const roomMatrix = ch.active.rooms[ch.roomName];
  ceneters.reverse();
  const power = addStampSomewhere(
    ceneters,
    STAMP_POWER,
    roomMatrix,
    ch.active.posCell
  );
  if (power === ERR_NOT_FOUND) return ERR_FULL;
  addRoad(pos, power, ch.active);
  const freePoints = surroundingPoints(power).filter(
    (p) =>
      roomMatrix.building.get(p.x, p.y) === PLANNER_COST.plain ||
      roomMatrix.building.get(p.x, p.y) === PLANNER_COST.swamp
  );
  if (freePoints.length) {
    const freePos = freePoints.reduce((a, b) =>
      pos.getRangeApprox(new RoomPosition(a.x, a.y, ch.roomName)) <=
      pos.getRangeApprox(new RoomPosition(b.x, b.y, ch.roomName))
        ? a
        : b
    );
    ch.active.posCell[prefix.powerCell] = [freePos.x, freePos.y];
    // DONT touch the power creep's spot :/
    roomMatrix.building.set(freePos.x, freePos.y, PLANNER_COST.structure);
    roomMatrix.movement.set(freePos.x, freePos.y, PLANNER_COST.structure);
  }
  addStampSomewhere(ceneters, STAMP_OBSERVE, roomMatrix, ch.active.posCell);
  return OK;
}

function addWalls(ch: PlannerChecking) {
  const costMatrix = initMatrix(ch.roomName);
  const roomMatrix = ch.active.rooms[ch.roomName];

  const posToProtect: Pos[] = [];
  const addedPos: Set<string> = new Set();
  for (let x = 0; x < 50; ++x)
    for (let y = 0; y < 50; ++y)
      if (
        roomMatrix.movement.get(x, y) === PLANNER_COST.structure &&
        costMatrix.movement.get(x, y) !== PLANNER_COST.structure
      )
        _.forEach(
          findCoordsInsideRect(x - 3, y - 3, x + 3, y + 3).filter(
            (p) => costMatrix.building.get(p.x, p.y) !== PLANNER_COST.wall
          ),
          (p) => {
            if (!addedPos.has(p.x + "_" + p.y)) {
              addedPos.add(p.x + "_" + p.y);
              posToProtect.push(p);
            }
          }
        );

  const ramps = minCutToExit(posToProtect, costMatrix.movement);

  // adding walls themselves
  _.forEach(ramps, (ramp) => {
    addStructure(
      new RoomPosition(ramp.x, ramp.y, ch.roomName),
      STRUCTURE_RAMPART,
      roomMatrix
    );
    // should add roads to walls?
  });
  ch.active.metrics.ramps = ramps.length;
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
  ch.active.posCell[prefix.upgradeCell] = [posContrLink.x, posContrLink.y];
  if (addRoad(pos, posContrLink, ch.active)[1] === ERR_NOT_IN_RANGE)
    return ERR_FULL;
  return OK;
}

function addResources(ch: PlannerChecking) {
  const pos = getPos(ch);
  const roomMatrix = ch.active.rooms[ch.roomName];
  ch.active.metrics.sumRoadRes = 0;

  for (const resPos of ch.sources) {
    const [ans, time] = addRoad(pos, resPos, ch.active);
    if (ans !== OK) return ERR_FULL;
    if (resPos.roomName === ch.roomName) ch.active.metrics.sumRoadRes += time;
    const containerPos = addContainer(
      resPos,
      ch.active.rooms[resPos.roomName],
      pos
    );
    if (containerPos === ERR_NOT_FOUND) return ERR_FULL;
    if (
      ch.roomName === resPos.roomName &&
      addLink(containerPos, roomMatrix, pos, 1, false) === ERR_NOT_FOUND
    )
      return ERR_FULL;
    endBlock(ch.active, STRUCTURE_ROAD);
  }
  endBlock(ch.active);

  for (const resPos of ch.minerals) {
    const [ans, time] = addRoad(pos, resPos, ch.active);
    if (ans !== OK) return ERR_FULL;
    if (resPos.roomName === ch.roomName) ch.active.metrics.sumRoadRes += time;
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

function addRestPos(ch: PlannerChecking) {
  const roomMatrix = ch.active.rooms[ch.roomName];
  const distResources = (p: Pos) => {
    const pos = new RoomPosition(p.x, p.y, ch.roomName);
    let dist = pos.getRangeApprox(pos) * PLANNER_REST_COEF.center;
    _.forEach(ch.sources, (r) => {
      dist +=
        r.getRangeApprox(pos) *
        (r.roomName === ch.roomName ? 1 : PLANNER_REST_COEF.annex);
    });
    _.forEach(ch.minerals, (r) => {
      dist +=
        r.getRangeApprox(pos) *
        PLANNER_REST_COEF.minerals *
        (r.roomName === ch.roomName ? 1 : PLANNER_REST_COEF.annex);
    });
    return dist;
  };
  const restPos = addStampSomewhere(
    ch.active.centers,
    STAMP_REST,
    roomMatrix,
    ch.active.posCell,
    false,
    (a, b) => (distResources(a) <= distResources(b) ? a : b)
  );
  if (restPos === ERR_NOT_FOUND) {
    const lastCenter = ch.active.centers.slice(-1)[0];
    let lastPos = new RoomPosition(lastCenter.x, lastCenter.y, ch.roomName);
    const freePos = lastPos
      .getPositionsInRange(6)
      .filter(
        (p) =>
          roomMatrix.movement.get(p.x, p.y) !== PLANNER_COST.wall &&
          roomMatrix.movement.get(p.x, p.y) !== PLANNER_COST.structure
      );
    if (freePos.length)
      lastPos = freePos.reduce((a, b) =>
        a.getOpenPositions().length >= b.getOpenPositions().length ? a : b
      );
    ch.active.posCell[prefix.excavationCell] = [lastPos.x, lastPos.y];
  }
  return OK;
}

function finalDefenses(ch: PlannerChecking) {
  // add RAMPART to storage/links/terminal??
  const roomMatrix = ch.active.rooms[ch.roomName];
  _.forEach(
    surroundingPoints(ch.controller).filter(
      (p) => roomMatrix.free.get(p.x, p.y) === PLANNER_FREE_MATRIX.outside
    ),
    (p) => addStructure(p, STRUCTURE_RAMPART, roomMatrix)
  );
  return OK;
}
