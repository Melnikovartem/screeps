import { ROOM_DIMENTIONS } from "static/constants";
import { towerCoef } from "static/utils";

import { addRoad } from "./addRoads";
import { addStampSomewhere } from "./addStamps";
import { surroundingPoints } from "./min-cut";
import { PLANNER_COST, PLANNER_STAMP_STOP } from "./planner-utils";
import type { PlannerChecking } from "./roomPlanner";
import { STAMP_TOWER } from "./stamps";

const PLANNER_INGORE_DMG_TOWER = 100;

const PLANNER_RADIUS_TOWER_CHECK = 10;

export function addTower(ch: PlannerChecking) {
  let cpu = Game.cpu.getUsed();
  let totalCpu = 0;
  const testingCpu = {
    it: (ref: string) => {
      const diff = Game.cpu.getUsed() - cpu;
      totalCpu += diff;
      console.log("after", ref, Math.round(diff * 1000) / 1000);
      cpu = Game.cpu.getUsed();
    },
    total: () => console.log("\ttotal cpu:", totalCpu),
  };

  const pos = new RoomPosition(
    ch.active.centers[0].x,
    ch.active.centers[0].y,
    ch.roomName
  );
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
  _.forEach(roomMatrix.compressed[STRUCTURE_TOWER]?.que || [], (towerPos) => {
    if (towerPos !== PLANNER_STAMP_STOP)
      _.forEach(
        allWalls,
        (val) =>
          (wallsDmg[val.to_str] +=
            towerCoef(
              { pos: new RoomPosition(towerPos[0], towerPos[1], ch.roomName) },
              val
            ) * TOWER_POWER_ATTACK)
      );
  });

  // dfs is not best best to find depth (floodfill is better)
  // but good enough for the task
  // kinda lazy to write other algos
  const matrixFree = new PathFinder.CostMatrix();
  const terrain = Game.map.getRoomTerrain(ch.roomName);
  for (let x = 0; x < ROOM_DIMENTIONS; ++x)
    for (let y = 0; y < ROOM_DIMENTIONS; ++y)
      if (terrain.get(x, y) === TERRAIN_MASK_WALL) matrixFree.set(x, y, 255);

  _.forEach(allWalls, (val) => matrixFree.set(val.x, val.y, 3));

  dfs(pos, matrixFree, 1, [0]);
  let positionsToCheck: Pos[] = [];
  _.forEach(
    allWalls,
    (val) =>
      (positionsToCheck = positionsToCheck.concat(
        dfs(val, matrixFree, 3, [255])
      ))
  );

  // all near outside replace with 10
  positionsToCheck = replaceAll(matrixFree, positionsToCheck, [3], 0, 10);
  // 2 and 3 deep into territory set 11 and 12
  positionsToCheck = replaceAll(matrixFree, positionsToCheck, [1, 3], 10, 11);
  replaceAll(matrixFree, positionsToCheck, [1, 3], 11, 12);

  A.showMap(
    ch.roomName,
    true,
    (x, y, vis) => {
      vis.text(matrixFree.get(x, y) + "", x, y, { color: "white" });
    },
    true
  );

  testingCpu.it("init");

  const getBestWallPos = () => {
    const minWall = _.min(allWalls, (val) => wallsDmg[val.to_str]);
    // const minDmg = wallsDmg[minWall.to_str];
    const lowestN = _.sortBy(allWalls, (val) => wallsDmg[val.to_str]).slice(
      0,
      Math.ceil(allWalls.length / 2)
    ); /* _.filter(
      allWalls,
      (val) => wallsDmg[val.to_str] - PLANNER_INGORE_DMG_TOWER <= minDmg
    );
    lowestN.sort((a, b) => pos.getRangeApprox(a) - pos.getRangeApprox(b)); */
    if (testingCpu) testingCpu.it("sort lowestN" + lowestN.length);
    const center: Pos = maxPointsCenter(
      _.map(lowestN, (p) => new Point(p.x, p.y)),
      PLANNER_RADIUS_TOWER_CHECK
    );
    return { x: formatVal(center.x), y: formatVal(center.y) };
  };

  const isFree = (p: Pos) => {
    const bc = roomMatrix.building.get(p.x, p.y);
    return bc === PLANNER_COST.plain || bc === PLANNER_COST.swamp;
  };

  const getSpot = () => {
    const bestWall = getBestWallPos();
    let towerPos: Pos | undefined = bestWall;
    const visitedCM = new PathFinder.CostMatrix();
    const toCheck: Pos[] = [];
    if (testingCpu) testingCpu.it("bestWall");
    visitedCM.set(towerPos.x, towerPos.y, 1);
    while (
      towerPos &&
      (matrixFree.get(towerPos.x, towerPos.y) !== 1 || !isFree(towerPos))
    ) {
      _.forEach(surroundingPoints(towerPos), (p) => {
        if (visitedCM.get(p.x, p.y)) return;
        toCheck.push(p);
        visitedCM.set(p.x, p.y, 1);
      });
      towerPos = toCheck.shift();
    }
    console.log(
      "TOWER @",
      JSON.stringify(towerPos),
      "FOR",
      JSON.stringify(bestWall)
    );
    return towerPos;
  };

  for (let i = 0; i < 6; ++i) {
    const towerSpot = getSpot();
    if (testingCpu) testingCpu.it("found spot");
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
    if (testingCpu) testingCpu.it("added wall");
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
  if (testingCpu) testingCpu.it("final");
  if (testingCpu) testingCpu.total();
  return OK;
}

function formatVal(val: number) {
  return Math.min(Math.max(Math.round(val), 0), 49);
}

// floodfill would be better cause we can visit same place several times, but it is fine also
function dfs(
  pos: RoomPosition,
  matrixFree: CostMatrix,
  value: number,
  replace: number[]
) {
  let positionsToCheck: Pos[] = [pos];
  matrixFree.set(pos.x, pos.y, value);
  _.forEach(pos.getPositionsInRange(1), (p) => {
    // not 0 and depth is better then this one
    const bc = matrixFree.get(p.x, p.y);
    if (!replace.includes(bc)) return;
    positionsToCheck = positionsToCheck.concat(
      dfs(p, matrixFree, value, replace)
    );
  });
  return positionsToCheck;
}

function replaceAll(
  matrixFree: CostMatrix,
  positionsToCheck: Pos[],
  valueReplace: number[],
  valueNear: number,
  valueSet: number
) {
  const valueChanged: Pos[] = [];
  _.forEach(positionsToCheck, (pp) => {
    const adjCoords = surroundingPoints(pp);
    if (
      valueReplace.includes(matrixFree.get(pp.x, pp.y)) &&
      _.filter(adjCoords, (p) => matrixFree.get(p.x, p.y) === valueNear).length
    ) {
      matrixFree.set(pp.x, pp.y, valueSet);
      _.forEach(adjCoords, (p) => valueChanged.push({ x: p.x, y: p.y }));
    }
  });
  return valueChanged;
}

// program to find the maximum number of
// points that can be enclosed by a fixed-radius
// circle

// complex class which has
// been used to implement points. This helps to
// ensure greater functionality easily
class Point {
  public x: number;
  public y: number;
  public constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  public subtract(other: Point) {
    return new Point(this.x - other.x, this.y - other.y);
  }
  public magnitude() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  public arg() {
    return Math.atan2(this.y, this.x);
  }
}

// This function returns the maximum points that
// can lie inside the circle of radius 'r' being
// rotated about point 'i'
type AngleInfo = [number, boolean, number];

function mycompare(A: AngleInfo, B: AngleInfo) {
  if (A[0] < B[0]) {
    return -1;
  } else if (A[0] > B[0]) {
    return 1;
  } else {
    return A[1] ? -1 : 1;
  }
}

function getPointsInside(
  i: number,
  r: number,
  n: number,
  arrPoints: Point[],
  dis: number[][]
): [number, Point] {
  // This vector stores alpha and beta and flag
  // is marked true for alpha and false for beta
  const angles: AngleInfo[] = [];
  for (let j = 0; j < n; j++) {
    if (i !== j && dis[i][j] <= 2 * r) {
      // acos returns the arc cosine of the complex
      // used for cosine inverse
      const B = Math.acos(dis[i][j] / (2 * r));

      // arg returns the phase angle of the complex
      const A = arrPoints[j].subtract(arrPoints[i]).arg();
      const alpha = A - B;
      const beta = A + B;
      angles.push([alpha, true, j]);
      angles.push([beta, false, j]);
    }
  }

  // angles vector is sorted and traversed
  angles.sort(mycompare);

  // count maintains the number of points inside
  // the circle at certain value of theta
  // res maintains the maximum of all count
  let count = 1;
  let res = 1;
  let bestCenter = arrPoints[i];
  for (const angl of angles) {
    // entry angle
    if (angl[1]) {
      count++;
    }

    // exit angle
    else {
      count--;
    }
    if (count > res) {
      res = count;
      const x = Math.cos(angl[0]) * r + arrPoints[angl[2]].x;
      const y = Math.sin(angl[0]) * r + arrPoints[angl[2]].y;
      bestCenter = new Point(x, y);
    }
  }
  return [res, bestCenter];
}

// Returns count of maximum points that can lie
// in a circle of radius r.
function maxPointsCenter(arrPoints: Point[], r: number) {
  const n = arrPoints.length;
  const dis = new Array(n).fill(0).map(() => new Array(n).fill(0) as number[]);
  // dis array stores the distance between every
  // pair of points
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      // abs gives the magnitude of the complex
      // number and hence the distance between
      // i and j
      dis[i][j] = dis[j][i] = arrPoints[i].subtract(arrPoints[j]).magnitude();
    }
  }

  // This loop picks a point p
  let ans = 0;
  let bestCenter = arrPoints[0];
  for (let i = 0; i < n; i++) {
    // maximum number of points for point arr[i]
    const [ansIt, centerIt] = getPointsInside(i, r, n, arrPoints, dis);
    if (ansIt > ans) {
      ans = ansIt;
      bestCenter = centerIt;
    }
  }
  return bestCenter;
}
