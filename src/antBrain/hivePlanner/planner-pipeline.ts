import { ROOM_DIMENTIONS } from "static/constants";
import { prefix } from "static/enums";
import { findCoordsInsideRect, towerCoef } from "static/utils";

import { addRoad, initMatrix } from "./addRoads";
import { addStampSomewhere, canAddStamp } from "./addStamps";
import { floodFill } from "./flood-fill";
import { minCutToExit, surroundingPoints } from "./min-cut";
import {
  addContainer,
  addLink,
  addStructure,
  endBlock,
  PLANNER_COST,
  PLANNER_STAMP_STOP,
} from "./planner-utils";
import type { PlannerChecking } from "./roomPlanner";
import {
  STAMP_CORE,
  STAMP_EXTENSION_BLOCK,
  STAMP_FAST_REFILL,
  STAMP_LABS,
  STAMP_OBSERVE,
  STAMP_POWER,
  STAMP_TOWER,
} from "./stamps";

type plannerStep = (ch: PlannerChecking) => OK | ERR_FULL;

// 50% of walls
const PLANNER_INGORE_DMG_TOWER = 0;

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
  addTowers,
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

function addTowers(ch: PlannerChecking) {
  const pos = getPos(ch);
  const roomMatrix = ch.active.rooms[ch.roomName];

  const wallsDmg: { [pos: string]: number } = {};
  const allWalls = _.map(
    _.filter(
      (roomMatrix.compressed[STRUCTURE_RAMPART]?.que || []).concat(
        roomMatrix.compressed[STRUCTURE_WALL]?.que || []
      ),
      (w) => w !== PLANNER_STAMP_STOP
    ) as [number, number][],
    (p) => new RoomPosition(p[0], p[1], ch.roomName)
  );
  _.forEach(allWalls, (val) => (wallsDmg[val.to_str] = 0));

  // dfs is not best best to find depth (floodfill is better)
  // but good enough for the task
  // kinda lazy to write other algos
  const matrixWalls = initMatrix(ch.roomName).movement;
  _.forEach(allWalls, (val) =>
    matrixWalls.set(val.x, val.y, PLANNER_COST.wall)
  );
  const matrixFree = new PathFinder.CostMatrix();
  const addExit = (x: number, y: number) => {
    if (roomMatrix.movement.get(x, y) === PLANNER_COST.wall) return;
    dfs(new RoomPosition(x, y, ch.roomName), matrixWalls, matrixFree);
  };
  for (let x = 0; x < ROOM_DIMENTIONS; ++x) {
    addExit(x, 0);
    addExit(x, ROOM_DIMENTIONS - 1);
  }
  for (let y = 0; y < ROOM_DIMENTIONS; ++y) {
    addExit(0, y);
    addExit(ROOM_DIMENTIONS - 1, y);
  }

  const getBestWallPos = () => {
    const minWall = _.min(allWalls, (val) => wallsDmg[val.to_str]);
    const minDmg = wallsDmg[minWall.to_str];
    const lowestN = _.filter(
      allWalls,
      (val) => wallsDmg[val.to_str] - PLANNER_INGORE_DMG_TOWER <= minDmg
    );
    const distToWall = floodFill(new PathFinder.CostMatrix(), lowestN);
    return allWalls.reduce((a, b) => {
      let diff = distToWall.get(a.x, a.y) - distToWall.get(b.x, b.y);
      if (Math.abs(diff) === 0)
        diff = pos.getRangeApprox(a) - pos.getRangeApprox(b);
      return diff <= 0 ? a : b;
    });
  };

  const getSpot = () => {
    const bestWall = getBestWallPos();
    let towerPos: Pos | undefined = bestWall;
    const visitedCM = new PathFinder.CostMatrix();
    const toCheck: Pos[] = [];
    while (towerPos && matrixFree.get(towerPos.x, towerPos.y) !== 0) {
      visitedCM.set(towerPos.x, towerPos.y, 1);
      _.forEach(surroundingPoints(towerPos), (p) => {
        const bc = roomMatrix.building.get(p.x, p.y);
        if (
          visitedCM.get(p.x, p.y) === 0 &&
          matrixFree.get(p.x, p.y) !== 1 &&
          (bc === PLANNER_COST.plain || bc === PLANNER_COST.swamp)
        )
          toCheck.push(p);
      });
      towerPos = toCheck.shift();
    }
    console.log("TOWER @", JSON.stringify(towerPos), "FOR", bestWall);
    return towerPos;
  };

  for (let i = 0; i < 6; ++i) {
    const towerSpot = getSpot();
    if (!towerSpot) return ERR_FULL;
    const towerPos = addStampSomewhere(
      [towerSpot],
      STAMP_TOWER,
      roomMatrix,
      ch.active.posCell,
      true
    );
    if (towerPos === ERR_NOT_FOUND) return ERR_FULL;
    addRoad(pos, towerPos, ch.active);
    _.forEach(
      allWalls,
      (val) =>
        (wallsDmg[val.to_str] +=
          towerCoef(
            { pos: new RoomPosition(towerPos.x, towerPos.y, ch.roomName) },
            val
          ) * TOWER_POWER_ATTACK)
    );
  }
  A.showMap(ch.roomName, true, (x, y, vis) => {
    const dmg = Math.round(
      wallsDmg[new RoomPosition(x, y, ch.roomName).to_str]
    );
    if (!dmg) return;
    vis.rect(x - 0.5, y - 0.5, 1, 1, {
      fill: "hsl(" + Math.round(dmg / (600 * 3)) * 255 + ", 100%, 60%)",
      opacity: 0.4,
    });
    vis.text(Math.round(dmg / 100) + "", x, y, { color: "black" });
  });
  return OK;
}

// floodfill would be better cause we can visit same place several times, but it is fine also
function dfs(
  pos: RoomPosition,
  matrixWalls: CostMatrix,
  matrixFree: CostMatrix,
  depth: number = 1
) {
  if (depth >= 4) return;

  if (depth > 1 || matrixWalls.get(pos.x, pos.y) === PLANNER_COST.wall) ++depth;
  matrixFree.set(pos.x, pos.y, depth);
  _.forEach(pos.getPositionsInRange(1), (p) => {
    const visited = matrixFree.get(p.x, p.y);
    // not 0 and depth is better then this one
    if (visited && visited <= depth) return;
    dfs(p, matrixWalls, matrixFree, depth);
  });
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
