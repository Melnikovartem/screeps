import { ERR_NO_VISION, ROOM_DIMENTIONS } from "static/constants";
import { findCoordsInsideRect } from "static/utils";

import { addRoad, initMatrix } from "./addRoads";
import { addStamp, addStampSomewhere, canAddStamp } from "./addStamps";
import { floodFill } from "./flood-fill";
import { minCutToExit } from "./min-cut";
import type { ActivePlan, RoomPlannerMatrix } from "./planner-active";
import {
  addContainer,
  addLink,
  addStructure,
  endBlock,
  PLANNER_COST,
} from "./planner-utils";
import {
  STAMP_CORE,
  STAMP_EXTENSION_BLOCK,
  STAMP_FAST_REFILL,
  STAMP_LABS,
} from "./stamps";
import { distanceTransform } from "./wall-dist";

const DIST_FROM_WALL = {
  idealHigh: 12,
  idealLow: 8,
  nonidealBelowMaxInRoom: -2,
  absoluteLow: 4,
};

const PLANNER_PADDING = {
  resource: 1,
  controller: 2,
};

const TAKE_N_BEST = 10;

/* chain startingPos -> {
  for goodPosition
    addCore
    addLabs
    addControllerRoads
    addResRoads
}
*/
export class RoomPlanner {
  // #region Properties (1)

  public checking:
    | {
        roomName: string;
        controller: RoomPosition;
        sources: RoomPosition[];
        minerals: RoomPosition[];

        bestMetric: number;
        best: ActivePlan;
        active: ActivePlan;
        positions: [Pos, number][];
      }
    | undefined;

  // #endregion Properties (1)

  // #region Public Methods (1)

  public createPlan(roomName: string) {
    const room = Game.rooms[roomName];
    if (!room) return ERR_NO_VISION;
    const posCont = room.controller?.pos;
    if (!posCont) return ERR_INVALID_TARGET;

    const sourcesPos = room
      .find(FIND_SOURCES)
      .map((r) => r.pos)
      .concat([new RoomPosition(24, 35, "W5N7")]);
    const mineralsPos = room.find(FIND_MINERALS).map((r) => r.pos);

    // add postion to check / road to exit to corridor ?

    Apiary.engine.addTask("planner " + roomName, () => {
      const posInterest: Pos[] = [posCont]
        .concat(sourcesPos)
        .concat(mineralsPos);
      const positions = this.startingPos(roomName, posInterest);
      if (!positions) return;
      this.checking = {
        roomName,
        controller: posCont,
        sources: sourcesPos,
        minerals: mineralsPos,
        bestMetric: Infinity,
        best: {
          posCell: {},
          rooms: {},
        },
        active: {
          posCell: {},
          rooms: {},
        },
        positions,
      };
      return () => this.checkPosition(roomName);
    });
    return OK;
  }

  // #endregion Public Methods (1)

  // #region Private Methods (4)

  private checkPosition(roomName: string) {
    const cpu = Game.cpu.getUsed();
    if (!this.checking) return;
    const posIter = this.checking.positions.shift();
    if (!posIter) return; // save best result

    const rFunc = () => console.log("ERROR"); // () => this.checkPosition(roomName);

    this.checking.active = {
      posCell: {},
      rooms: { [roomName]: initMatrix(roomName) },
    };

    const ap = this.checking.active;

    _.forEach(
      findCoordsInsideRect(
        this.checking.controller.x - PLANNER_PADDING.controller,
        this.checking.controller.y - PLANNER_PADDING.controller,
        this.checking.controller.x + PLANNER_PADDING.controller,
        this.checking.controller.y + PLANNER_PADDING.controller
      ),
      (p) =>
        this.checking!.active.rooms[roomName].building.set(
          p.x,
          p.y,
          PLANNER_COST.wall
        )
    );
    _.forEach(this.checking.sources.concat(this.checking.minerals), (res) => {
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

    const pos = new RoomPosition(posIter[0].x, posIter[0].y, roomName);
    const roomMatrix = ap.rooms[roomName];

    // add main stamp - core
    if (canAddStamp(pos, STAMP_CORE, roomMatrix) !== OK) return rFunc;
    addStamp(pos, STAMP_CORE, roomMatrix);

    // add stamp lab
    const lab = addStampSomewhere([pos], STAMP_LABS, roomMatrix, ap.posCell);
    if (lab === ERR_NOT_FOUND) return rFunc;
    // add stamp fastrefill
    const fastRef = addStampSomewhere(
      [pos, lab],
      STAMP_FAST_REFILL,
      roomMatrix,
      ap.posCell
    );
    if (fastRef === ERR_NOT_FOUND) return rFunc;

    addRoad(pos, lab, ap);
    addRoad(pos, fastRef, ap, 3);
    addRoad(new RoomPosition(lab.x, lab.y, roomName), fastRef, ap, 3);

    endBlock(ap);

    const ceneters = [pos, lab, fastRef];
    // (60 - 14) / 5 = 8.8
    for (let i = 0; i < 12; ++i) {
      const extentionPos = addStampSomewhere(
        ceneters,
        STAMP_EXTENSION_BLOCK,
        roomMatrix,
        ap.posCell
      );
      if (extentionPos === ERR_NOT_FOUND) return rFunc;
      addRoad(pos, extentionPos, ap);
      // endBlock(ap);
    }

    // todo add powerspawn and oberver

    // adding walls themselves
    _.forEach(this.generateWalls(roomName, roomMatrix), (ramp) => {
      addStructure(
        new RoomPosition(ramp.x, ramp.y, roomName),
        STRUCTURE_RAMPART,
        roomMatrix
      );
      // should add roads to walls?
    });

    // adding controller stuff
    const posContrLink = addLink(this.checking.controller, roomMatrix, pos);
    if (posContrLink === ERR_NOT_FOUND) return rFunc;
    if (addRoad(pos, posContrLink, ap) === ERR_NOT_IN_RANGE) return rFunc;

    endBlock(ap);

    const resources = this.checking.sources;
    resources.sort((a, b) => pos.getRangeApprox(a) - pos.getRangeApprox(b));
    for (const resPos of resources) {
      if (addRoad(pos, resPos, ap) !== OK) return rFunc;
      const containerPos = addContainer(resPos, ap.rooms[resPos.roomName], pos);
      if (containerPos === ERR_NOT_FOUND) return rFunc;
      if (
        roomName === resPos.roomName &&
        addLink(containerPos, roomMatrix, pos, 1) === ERR_NOT_FOUND
      )
        return rFunc;
      endBlock(ap, STRUCTURE_ROAD);
    }
    endBlock(ap);

    const minerals = this.checking.sources;
    minerals.sort((a, b) => pos.getRangeApprox(a) - pos.getRangeApprox(b));
    for (const resPos of this.checking.minerals) {
      if (addRoad(pos, resPos, ap) !== OK) return rFunc;
      const containerPos = addContainer(resPos, ap.rooms[resPos.roomName], pos);
      if (containerPos === ERR_NOT_FOUND) return rFunc;
      if (roomName === resPos.roomName)
        addStructure(resPos, STRUCTURE_EXTRACTOR, roomMatrix);
      endBlock(ap);
    }

    this.checking.best = this.checking.active;
    console.log("CPU used:", Game.cpu.getUsed() - cpu);
    return () => console.log("OK"); // rFunc;
  }

  private generateWalls(roomName: string, roomMatrix: RoomPlannerMatrix) {
    const costMatrix = initMatrix(roomName).movement;

    const posToProtect: Pos[] = [];
    const addedPos: Set<string> = new Set();
    for (let x = 0; x < 50; ++x)
      for (let y = 0; y < 50; ++y)
        if (
          roomMatrix.movement.get(x, y) === PLANNER_COST.structure &&
          costMatrix.get(x, y) !== PLANNER_COST.structure
        )
          _.forEach(
            new RoomPosition(x, y, roomName).getOpenPositions(false, 3),
            (p) => {
              if (!addedPos.has(p.to_str)) {
                addedPos.add(p.to_str);
                posToProtect.push(p);
              }
            }
          );

    const ramps = minCutToExit(posToProtect, costMatrix);
    return ramps;
  }

  private startingPos(roomName: string, posInterest: Pos[]) {
    const costMatrix = initMatrix(roomName).movement;

    const distanceMap = distanceTransform(costMatrix);
    let positions: [Pos, number][] = [];
    for (let x = 0; x < ROOM_DIMENTIONS; ++x)
      for (let y = 0; y < ROOM_DIMENTIONS; ++y)
        if (distanceMap.get(x, y) < PLANNER_COST.wall)
          positions.push([{ x, y }, distanceMap.get(x, y)]);

    positions = _.filter(positions, (p) => p[1] >= DIST_FROM_WALL.absoluteLow);
    // room is literal block of walls
    if (!positions) return;

    const idealPositions = _.filter(
      positions,
      (p) => DIST_FROM_WALL.idealLow <= p[1] && p[1] <= DIST_FROM_WALL.idealHigh
    );
    if (idealPositions.length) positions = idealPositions;
    else {
      const maxAllowed =
        _.max(positions, (p) => p[1])[1] +
        DIST_FROM_WALL.nonidealBelowMaxInRoom;
      positions = _.filter(positions, (p) => p[1] >= maxAllowed);
    }

    const fillMap = floodFill(costMatrix, posInterest);

    positions.sort((a, b) => {
      // closer to some important points is better
      let diff = fillMap.get(a[0].x, a[0].y) - fillMap.get(b[0].x, b[0].y);
      // further from walls is better
      if (Math.abs(diff) <= 1) diff = b[1] - a[1];
      // center is better then edges ?
      if (Math.abs(diff) === 0) {
        // lower is better
        const fInvNorm = (pp: Pos) => (pp.x + pp.y) / (pp.x * pp.y);
        diff = fInvNorm(a[0]) - fInvNorm(b[0]);
      }
      return diff;
    });
    positions.splice(TAKE_N_BEST);
    return positions;
  }

  // #endregion Private Methods (4)
}

/** 
 * 
 * 
    A.showMap(roomName, true, (x, y, vis) => {
      vis.rect(x - 0.5, y - 0.5, 1, 1, {
        fill:
          "hsl(" +
          Apiary.colony.planner.checking!.active.rooms[roomName].building.get(x, y) +
          ", 100%, 60%)",
        opacity: 0.4,
      });
      if (ramps.filter((p) => p.x === x && p.y === y).length)
        vis.text("x", x, y, { color: "black" });
    });
*/
