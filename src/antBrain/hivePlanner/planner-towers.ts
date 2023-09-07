import { ROOM_DIMENTIONS } from "static/constants";
import { towerCoef } from "static/utils";

import { addRoad } from "./addRoads";
import { addStampSomewhere } from "./addStamps";
import { surroundingPoints } from "./min-cut";
import { PLANNER_COST, PLANNER_STAMP_STOP } from "./planner-utils";
import type { PlannerChecking } from "./roomPlanner";
import { STAMP_TOWER } from "./stamps";

const PLANNER_INGORE_DMG_TOWER = 100;
const PLANNER_PROC_WALLS_CHECK = 0.5;
const PLANNER_RADIUS_TOWER_CHECK = 10;

export const PLANNER_TOWERS = CONTROLLER_STRUCTURES[STRUCTURE_TOWER][8];

export const PLANNER_FREE_MATRIX = {
  outside: 0,
  inside: 1,
  def: 3,
  walls: 255,
  range1: 10,
  range2: 11,
  range3: 12,
};

export function addTowers(ch: PlannerChecking) {
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

  const terrain = Game.map.getRoomTerrain(ch.roomName);
  for (let x = 0; x < ROOM_DIMENTIONS; ++x)
    for (let y = 0; y < ROOM_DIMENTIONS; ++y)
      if (terrain.get(x, y) === TERRAIN_MASK_WALL)
        roomMatrix.free.set(x, y, PLANNER_FREE_MATRIX.walls);

  _.forEach(allWalls, (val) =>
    roomMatrix.free.set(val.x, val.y, PLANNER_FREE_MATRIX.def)
  );

  dfs(pos, roomMatrix.free, PLANNER_FREE_MATRIX.inside, [
    PLANNER_FREE_MATRIX.outside,
  ]);
  let positionsToCheck: Pos[] = [];
  // add some walls as part of defense
  _.forEach(
    allWalls,
    (val) =>
      (positionsToCheck = positionsToCheck.concat(
        dfs(val, roomMatrix.free, PLANNER_FREE_MATRIX.def, [
          PLANNER_FREE_MATRIX.walls,
        ])
      ))
  );

  // all def near outside replace with 10
  positionsToCheck = replaceAll(
    roomMatrix.free,
    positionsToCheck,
    [PLANNER_FREE_MATRIX.def],
    PLANNER_FREE_MATRIX.outside,
    PLANNER_FREE_MATRIX.range1
  );
  // 2 and 3 deep into territory set 11 and 12
  positionsToCheck = replaceAll(
    roomMatrix.free,
    positionsToCheck,
    [PLANNER_FREE_MATRIX.inside, PLANNER_FREE_MATRIX.def],
    PLANNER_FREE_MATRIX.range1,
    PLANNER_FREE_MATRIX.range2
  );
  replaceAll(
    roomMatrix.free,
    positionsToCheck,
    [PLANNER_FREE_MATRIX.inside, PLANNER_FREE_MATRIX.def],
    PLANNER_FREE_MATRIX.range2,
    PLANNER_FREE_MATRIX.range3
  );

  const getBestWallPos = () => {
    const minWall = _.min(allWalls, (val) => wallsDmg[val.to_str]);
    const minDmg = wallsDmg[minWall.to_str];
    let lowestN = _.sortBy(allWalls, (val) => wallsDmg[val.to_str]);
    const leaveByPortion = Math.ceil(
      allWalls.length * PLANNER_PROC_WALLS_CHECK
    );
    const leaveBySort = _.filter(
      lowestN,
      (val) => wallsDmg[val.to_str] - PLANNER_INGORE_DMG_TOWER <= minDmg
    ).length;
    lowestN = lowestN.slice(0, Math.min(leaveByPortion, leaveBySort));
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
    visitedCM.set(towerPos.x, towerPos.y, 1);
    while (
      towerPos &&
      (roomMatrix.free.get(towerPos.x, towerPos.y) !==
        PLANNER_FREE_MATRIX.inside ||
        !isFree(towerPos))
    ) {
      _.forEach(
        _.sortBy(surroundingPoints(towerPos), (p) =>
          pos.getRangeApprox(new RoomPosition(p.x, p.y, ch.roomName))
        ),
        (p) => {
          if (visitedCM.get(p.x, p.y)) return;
          toCheck.push(p);
          visitedCM.set(p.x, p.y, 1);
        }
      );
      towerPos = toCheck.shift();
    }
    return towerPos;
  };

  ch.active.metrics.sumRoadTower = 0;
  for (let i = 0; i < PLANNER_TOWERS; ++i) {
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
    ch.active.metrics.sumRoadTower += addRoad(pos, towerPos, ch.active)[1];
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
  /* A.showMap(ch.roomName, true, (x, y, vis) => {
    const dmg = Math.round(
      wallsDmg[new RoomPosition(x, y, ch.roomName).to_str]
    );
    if (!dmg) return;
    vis.rect(x - 0.5, y - 0.5, 1, 1, {
      fill: "hsl(" + Math.round(dmg / (600 * 3)) * 255 + ", 100%, 60%)",
      opacity: 0.4,
    });
    vis.text(Math.round(dmg / 100) + "", x, y, { color: "black" });
  }); */
  ch.active.metrics.minDmg =
    wallsDmg[_.min(allWalls, (val) => wallsDmg[val.to_str]).to_str];
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
  public add(other: Point) {
    return new Point(this.x + other.x, this.y + other.y);
  }
  public divide(num: number) {
    return new Point(this.x / num, this.y / num);
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
  let bestCenter1 = arrPoints[i];
  let bestMoment = Array(n).fill(0);
  const inThisMoment = Array(n).fill(0);
  for (const angl of angles) {
    // entry angle
    if (angl[1]) {
      count++;
      inThisMoment[angl[2]] = 1;
    }

    // exit angle
    else {
      count--;
      inThisMoment[angl[2]] = 0;
    }
    if (count > res) {
      res = count;
      const x = Math.cos(angl[0]) * r + arrPoints[i].x;
      const y = Math.sin(angl[0]) * r + arrPoints[i].y;
      bestCenter1 = new Point(x, y);
      bestMoment = inThisMoment.slice();
    }
  }
  const Points: Point[] = [];
  for (let j = 0; j < n; ++j) {
    if (bestMoment[j] || j === i) Points.push(arrPoints[j]);
  }
  // try to build minimul enclosing circle
  const bestCenter2 = welzl(Points).C;
  return [res, bestCenter1.add(bestCenter2).divide(2)];
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

// JS program to find the minimum enclosing
// circle for N integer points in a 2-D plane

interface Circle {
  C: Point;
  R: number;
}

// Function to get random int
function getRandomInt() {
  return Math.ceil(Math.random() * 32679);
}

// Function to shuffle array
function shuffle(array: Point[]) {
  let currentIndex = array.length;
  let randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex !== 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}

// Function to return the euclidean distance
// between two points
function dist(a: Point, b: Point) {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

// Function to check whether a point lies inside
// or on the boundaries of the circle
function isInside(c: Circle, p: Point) {
  return dist(c.C, p) <= c.R;
}

// The following two functions are used
// To find the equation of the circle when
// three points are given.

// Helper method to get a circle defined by 3 points
function getCircleCenter(bx: number, by: number, cx: number, cy: number) {
  const B = bx * bx + by * by;
  const C = cx * cx + cy * cy;
  const D = bx * cy - by * cx;
  return new Point((cy * B - by * C) / (2 * D), (bx * C - cx * B) / (2 * D));
}

// Function to return a unique circle that
// intersects three points
function circleFrom3(A: Point, B: Point, C: Point): Circle {
  const I = getCircleCenter(B.x - A.x, B.y - A.y, C.x - A.x, C.y - A.y);

  I.x += A.x;
  I.y += A.y;
  return { C: I, R: dist(I, A) };
}

// Function to return the smallest circle
// that intersects 2 points
function circleFrom2(A: Point, B: Point) {
  // Set the center to be the midpoint of A and B
  const C = new Point((A.x + B.x) / 2.0, (A.y + B.y) / 2.0);

  // Set the radius to be half the distance AB
  return { C, R: dist(A, B) / 2.0 };
}

// Function to check whether a circle
// encloses the given points
function isValidCircle(c: Circle, P: Point[]) {
  // Iterating through all the points
  // to check  whether the points
  // lie inside the circle or not
  for (const p of P) if (!isInside(c, p)) return false;
  return true;
}

// Function to return the minimum enclosing
// circle for N <= 3
function minCircleTrivial(P: Point[]): Circle {
  if (P.length === 0) {
    return { C: new Point(0, 0), R: 0 };
  } else if (P.length === 1) {
    return { C: P[0], R: 0 };
  } else if (P.length === 2) {
    return circleFrom2(P[0], P[1]);
  }

  // To check if MEC can be determined
  // by 2 points only
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      const c = circleFrom2(P[i], P[j]);
      if (isValidCircle(c, P)) return c;
    }
  }
  return circleFrom3(P[0], P[1], P[2]);
}

// Returns the MEC using Welzl's algorithm
// Takes a set of input points P and a set R
// points on the circle boundary.
// n represents the number of points in P
// that are not yet processed.
function welzlHelper(P: Point[], n: number, R: Point[]): Circle {
  // Base case when all points processed or |R| = 3
  if (n === 0 || R.length === 3) {
    return minCircleTrivial(R);
  }

  // Pick a random point randomly
  const idx = getRandomInt() % n;
  const p = P[idx];

  // Put the picked point at the end of P
  // since it's more efficient than
  // deleting from the middle of the vector
  const temp = P[idx];
  P[idx] = P[n - 1];
  P[n - 1] = temp;

  // Get the MEC circle d from the
  // set of points P - {p}
  const d = welzlHelper(P, n - 1, [...R]);

  // If d contains p, return d
  if (isInside(d, p)) {
    return d;
  }

  // Otherwise, must be on the boundary of the MEC
  R.push(p);

  // Return the MEC for P - {p} and R U {p}
  return welzlHelper(P, n - 1, [...R]);
}

function welzl(P: Point[]): Circle {
  const PCopy = [...P];

  shuffle(PCopy);
  return welzlHelper(PCopy, P.length, []);
}
