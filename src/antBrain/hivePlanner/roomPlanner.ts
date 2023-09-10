import type { FnEngine } from "engine";
import type { Hive } from "hive/hive";
import { ROOM_DIMENTIONS } from "static/constants";

import { addRoad, initMatrix } from "./addRoads";
import { floodFill } from "./flood-fill";
import {
  type ActivePlan,
  fromCache,
  parseInitPlan,
  parseRoomInternal,
  PLANNER_EMPTY_METRICS,
  savePlan,
} from "./planner-active";
import { calcMetric, recalcMetricsActive } from "./planner-metric";
import { PLANNER_ROADS, PLANNER_STEPS } from "./planner-pipeline";
import {
  addStructure,
  emptySpot,
  endBlock,
  PLANNER_COST,
} from "./planner-utils";
import { distanceTransform } from "./wall-dist";

const DIST_FROM_WALL = {
  idealHigh: 12,
  idealLow: 8,
  nonidealBelowMaxInRoom: -2,
  absoluteLow: 4,
};

const PLANNER_INVALIDATE_TIME = 1000;

const TAKE_N_BEST = 10;

export interface PlannerChecking {
  // #region Properties (10)

  active: ActivePlan;
  activeStep: number;
  best: ActivePlan;
  bestMetric: number;
  controller: RoomPosition;
  lastUpdated: number;
  minerals: RoomPosition[];
  positions: Pos[];
  roomName: string;
  sources: RoomPosition[];

  // #endregion Properties (10)
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
  // #region Properties (9)

  protected fromCache = fromCache;
  protected parseInitPlan = parseInitPlan;
  protected parseRoomInternal = parseRoomInternal;
  protected parsingRooms:
    | {
        roomName: string;
        rooms: string[];
        sources: RoomPosition[];
        minerals: RoomPosition[];
        controller: RoomPosition;
      }
    | undefined;

  public addRoad = addRoad;
  public addStructure = addStructure;
  public checking: PlannerChecking | undefined;
  public emptySpot = emptySpot;
  public savePlan = savePlan;

  // #endregion Properties (9)

  // #region Public Accessors (1)

  public get canStartNewPlan() {
    return !this.checking && !this.parsingRooms;
  }

  // #endregion Public Accessors (1)

  // #region Public Methods (4)

  public createPlan(
    roomName: string,
    annexNames: string[],
    extraStartingPos: Pos[] = []
  ) {
    const firstIter = this.parseInitPlan(roomName, annexNames, () => {
      if (!this.checking) return; // something failed
      const posInterest: Pos[] = [this.checking.controller]
        .concat(this.checking.sources)
        .concat(this.checking.minerals);

      const positions = this.startingPos(roomName, posInterest).concat(
        _.map(extraStartingPos, (p) => {
          return { x: p.x, y: p.y }; // if we add roompositions we drop roomName
        })
      );
      if (!positions.length) return;

      this.checking.positions = positions;
      return this.checkPosition(roomName, PLANNER_STEPS);
    });
    if (firstIter)
      Apiary.engine.addTask("planner main @" + roomName, () => firstIter);

    return OK;
  }

  public createRoads(hive: Hive) {
    const firstIter = this.parseInitPlan(hive.roomName, hive.annexNames, () => {
      if (this.fromCache(hive.roomName) !== OK) return;
      return this.checkPosition(hive.roomName, PLANNER_ROADS);
    });
    if (firstIter)
      Apiary.engine.addTask("roads plan @" + hive.roomName, () => firstIter);
  }

  public justShow(roomName: string) {
    const posCont =
      Game.rooms[roomName].controller?.pos ||
      new RoomPosition(25, 25, roomName);
    this.initPlan(roomName, posCont, [], []);
    this.fromCache(roomName);
  }

  public update() {
    if (!this.checking) return;
    if (this.checking.lastUpdated + PLANNER_INVALIDATE_TIME > Game.time) return;
    // remove checking if is up too long
    this.checking = undefined;
  }

  public recalcMetricsActive = recalcMetricsActive;

  // #endregion Public Methods (4)

  // #region Protected Methods (1)

  protected initPlan(
    roomName: string,
    posCont: RoomPosition,
    sourcesPos: RoomPosition[],
    mineralsPos: RoomPosition[],
    positions: Pos[] = []
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
      lastUpdated: Game.time,
    };
  }

  // #endregion Protected Methods (1)

  // #region Private Methods (3)

  private checkPosition(
    roomName: string,
    steps: typeof PLANNER_STEPS
  ): ReturnType<FnEngine> {
    if (!this.checking) return;

    const rFunc = { f: () => this.checkPosition(roomName, steps) };

    const cpu = Game.cpu.getUsed();
    let ans: OK | ERR_FULL | ERR_NOT_FOUND | ERR_NOT_IN_RANGE = OK;
    const desc = () =>
      console.log(
        `\tPLANNER STEP ${
          this.checking ? steps[this.checking.activeStep].name : "NOCKECKING"
        } ${
          ans === OK
            ? "FINISHED"
            : ans === ERR_NOT_IN_RANGE
            ? "REPEATING"
            : "FAILED!!!"
        } IN ${Math.round((Game.cpu.getUsed() - cpu) * 1000) / 1000}`
      );

    ans = steps[this.checking.activeStep](this.checking);
    endBlock(this.checking.active);

    if (ans === ERR_NOT_FOUND) {
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

    if (ans === ERR_NOT_IN_RANGE) {
      return rFunc;
    }

    this.checking.lastUpdated = Game.time;

    if (ans !== OK) desc();

    if (ans === ERR_FULL) {
      // error go next position
      const pos = this.checking.active.centers[0] as RoomPosition;
      console.log(`-FAILED ATTEMPT @${pos.print}`);
      this.checking.activeStep = 0;
      return rFunc;
    }

    ++this.checking.activeStep;
    if (this.checking.activeStep >= steps.length) {
      // finished full position
      // 100+ CPU final product
      this.checking.activeStep = 0;
      const finalMetric = calcMetric(this.checking.active.metrics);
      if (finalMetric >= this.checking.best.metrics.final)
        this.checking.best = this.checking.active;
      const pos = this.checking.active.centers[0] as RoomPosition;
      console.log(
        `+SUCCESSFUL ATTEMPT @${pos.print} SCORE: ${this.checking.active.metrics.final}`
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
    return _.map(positions, (p) => p[0]);
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
