import type { FnEngine } from "engine";
import type { Hive } from "hive/hive";
import { ERR_NO_VISION, ROOM_DIMENTIONS } from "static/constants";

import { initMatrix } from "./addRoads";
import { floodFill } from "./flood-fill";
import {
  type ActivePlan,
  fromCache,
  parseRoom,
  PLANNER_EMPTY_METRICS,
  savePlan,
  toActive,
} from "./planner-active";
import {
  PLANNER_EXTENSION,
  PLANNER_ROADS,
  PLANNER_STEPS,
} from "./planner-pipeline";
import { PLANNER_TOWERS } from "./planner-towers";
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
  // #region Properties (9)

  active: ActivePlan;
  activeStep: number;
  best: ActivePlan;
  bestMetric: number;
  controller: RoomPosition;
  minerals: RoomPosition[];
  positions: [Pos, number][];
  roomName: string;
  sources: RoomPosition[];

  // #endregion Properties (9)
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
  // #region Properties (6)

  protected fromCache = fromCache;
  protected parsingRooms:
    | {
        roomName: string;
        rooms: string[];
        sources: RoomPosition[];
        minerals: RoomPosition[];
        controller: RoomPosition;
      }
    | undefined;
  protected toActive = toActive;

  public checking: PlannerChecking | undefined;
  public parseRoom = parseRoom;
  public savePlan = savePlan;

  // #endregion Properties (6)

  // #region Public Methods (3)

  public createPlan(roomName: string) {
    const room = Game.rooms[roomName];
    if (!room) return ERR_NO_VISION;
    const posCont = room.controller?.pos;
    if (!posCont) return ERR_INVALID_TARGET;

    const sourcesPos = room.find(FIND_SOURCES).map((r) => r.pos);
    const mineralsPos = room.find(FIND_MINERALS).map((r) => r.pos);

    const posInterest: Pos[] = [posCont].concat(sourcesPos).concat(mineralsPos);
    let positions: [Pos, number][] = [];
    positions = this.startingPos(roomName, posInterest);
    if (!positions.length) return;

    // add postion to check / road to exit to corridor ??
    Apiary.engine.addTask("planner main @" + roomName, () => {
      this.initPlan(roomName, posCont, sourcesPos, mineralsPos, positions);
      return { f: () => this.checkPosition(roomName, PLANNER_STEPS) };
    });
    return OK;
  }

  public createRoads(hive: Hive) {
    Apiary.engine.addTask("roads plan @" + hive.roomName, () =>
      this.toActive(
        hive.roomName,
        hive.annexNames,
        this.checkPosition(hive.roomName, PLANNER_ROADS)?.f
      )
    );
  }

  public justShow(hive: Hive) {
    Apiary.engine.addTask("show plan @" + hive.roomName, () =>
      this.toActive(hive.roomName, hive.annexNames, undefined)
    );
  }

  // #endregion Public Methods (3)

  // #region Protected Methods (1)

  protected initPlan(
    roomName: string,
    posCont: RoomPosition,
    sourcesPos: RoomPosition[],
    mineralsPos: RoomPosition[],
    positions: [Pos, number][] = []
  ) {
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
        metrics: { ...PLANNER_EMPTY_METRICS },
      },
      active: {
        centers: [],
        posCell: {},
        rooms: {},
        metrics: { ...PLANNER_EMPTY_METRICS },
      },
      positions,
    };
  }

  // #endregion Protected Methods (1)

  // #region Private Methods (3)

  private calcMetric() {
    if (!this.checking) return -Infinity;
    let metric = 0;
    const me = this.checking.active.metrics; // this comment style -> expecteed range
    // can tollerate no more then 80 ramps
    metric += (1 - me.ramps / 80) * 60; // 0 -> 60
    // baseline is 3 towers full bunker
    metric += (me.minDmg / (TOWER_POWER_ATTACK * 3)) * 40; // 0 -> 40
    const addRoadMetric = (roadTime: number, avg = 1) => {
      // 0 -> 5
      metric += (1 - roadTime / avg / ROOM_DIMENTIONS) * 5;
    };
    // at all 0 -> 30 for roads
    addRoadMetric(me.sumRoadRes, PLANNER_TOWERS);
    // twice the weight
    addRoadMetric(me.sumRoadExt, PLANNER_EXTENSION / 2);
    addRoadMetric(me.sumRoadRes, 3); // energy 2x + mineral
    addRoadMetric(me.roadLabs);
    addRoadMetric(me.roadFastRef);
    metric += me.final = Math.round(metric * 1000) / 1000;
    return metric;
  }

  private checkPosition(
    roomName: string,
    steps: typeof PLANNER_STEPS
  ): ReturnType<FnEngine> {
    if (!this.checking) return;

    const rFunc = { f: () => this.checkPosition(roomName, steps) };

    const cpu = Game.cpu.getUsed();
    let ans: OK | ERR_FULL | ERR_NOT_FOUND = OK;
    const desc = () =>
      ans !== OK
        ? console.log(
            `\tPLANNER STEP ${
              this.checking
                ? PLANNER_STEPS[this.checking.activeStep].name
                : "NOCKECKING"
            } ${"FAILED!!!"} IN ${
              // ans === OK ? "FINISHED" : "FAILED!!!"
              Math.round((Game.cpu.getUsed() - cpu) * 1000) / 1000
            }`
          )
        : undefined;

    ans = PLANNER_STEPS[this.checking.activeStep](this.checking);
    endBlock(this.checking.active);

    if (ans === ERR_FULL && !this.checking.activeStep) {
      // finished all positions
      ans = this.savePlan();
      this.checking = undefined;
      return {
        f: () =>
          console.log(
            `PLANNER SAVING ${ans === OK ? "DONE" : "FAILED"} @${roomName}`
          ),
      };
    }

    desc();

    if (ans === ERR_FULL) {
      // error go next position
      console.log(`-FAILED ATTEMPT @${this.checking.active.centers[0]}`);
      this.checking.activeStep = 0;
      return rFunc;
    }

    ++this.checking.activeStep;
    if (this.checking.activeStep >= PLANNER_STEPS.length) {
      // finished full position
      // 100+ CPU final product
      this.checking.activeStep = 0;
      this.calcMetric();
      if (
        (this.checking.active.metrics.final || 0) >
        (this.checking.best.metrics.final || 0)
      )
        this.checking.best = this.checking.active;
      console.log(
        `+SUCCESSFUL ATTEMPT @${this.checking.active.centers[0]} SCORE: ${this.checking.active.metrics.final}`
      );
      return rFunc;
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
    if (!positions) return [];

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

  // #endregion Private Methods (3)
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
