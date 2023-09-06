import type { FnEngine } from "engine";
import { ERR_NO_VISION, ROOM_DIMENTIONS } from "static/constants";

import { initMatrix } from "./addRoads";
import { floodFill } from "./flood-fill";
import type { ActivePlan } from "./planner-active";
import { PLANNER_STEPS } from "./planner-pipeline";
import { endBlock, PLANNER_COST } from "./planner-utils";
import { distanceTransform } from "./wall-dist";

const DIST_FROM_WALL = {
  idealHigh: 12,
  idealLow: 8,
  nonidealBelowMaxInRoom: -2,
  absoluteLow: 4,
};

const TAKE_N_BEST = 10;

export interface PlannerChecking {
  roomName: string;
  controller: RoomPosition;
  sources: RoomPosition[];
  minerals: RoomPosition[];

  bestMetric: number;
  best: ActivePlan;
  active: ActivePlan;
  activeStep: number;
  positions: [Pos, number][];
}

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

  public checking: PlannerChecking | undefined;

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
        activeStep: 0,
        controller: posCont,
        sources: sourcesPos,
        minerals: mineralsPos,
        bestMetric: Infinity,
        best: {
          centers: [],
          posCell: {},
          rooms: {},
        },
        active: {
          centers: [],
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

  private checkPosition(roomName: string): FnEngine | void {
    if (!this.checking) return;

    const rFunc = () => this.checkPosition(roomName);

    const cpu = Game.cpu.getUsed();
    let ans: OK | ERR_FULL = OK;
    const desc = () =>
      console.log(
        `PLANNER STEP ${
          this.checking
            ? PLANNER_STEPS[this.checking.activeStep].name
            : "NOCKECKING"
        } ${ans === OK ? "FINISHED" : "FAILED!!!"} IN: ${
          Math.round((Game.cpu.getUsed() - cpu) * 1000) / 1000
        }`
      );

    ans = PLANNER_STEPS[this.checking.activeStep](this.checking);
    endBlock(this.checking.active);
    desc();

    if (ans === ERR_FULL && !this.checking.activeStep) {
      // finished all positions
      this.checking = undefined;
      // @todo save best
      return undefined;
    }

    if (ans === ERR_FULL) {
      // error go next position
      return undefined; // rFunc;
    }

    this.checking.activeStep++;
    if (this.checking.activeStep >= PLANNER_STEPS.length) {
      // finished full position
      // 110 + CPU final product
      this.checking.activeStep = 0;
      return undefined; // rFunc;
    }

    // go do next step
    return rFunc;
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
