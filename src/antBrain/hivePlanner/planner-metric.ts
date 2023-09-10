import { ROOM_DIMENTIONS } from "static/constants";
import { prefix } from "static/enums";

import { addRoad } from "./addRoads";
import {
  calcTowerDmg,
  getPos,
  PLANNER_STAMP_STOP,
  PLANNER_TOWERS,
} from "./planner-utils";
import type { RoomPlanner } from "./roomPlanner";

/** when adding roads metrics should become better (or same) */
export interface PlannerMetrics {
  /** number of ramps */
  ramps: number;
  /** minDmg in absolute value */
  minDmg: number;
  sumRoadTower: number;
  maxRoadExt: number;
  roadCont: number;
  roadLabs: number;
  roadFastRef: number;
  final: number;
}

export function recalcMetricsActive(this: RoomPlanner) {
  if (!this.checking) return 0;
  const ch = this.checking;
  const roomMatrix = ch.active.rooms[ch.roomName];
  const pos = getPos(ch);

  const extensions = _.map(
    (roomMatrix.compressed[STRUCTURE_EXTENSION]?.que || []).filter(
      (p) => p !== PLANNER_STAMP_STOP
    ) as [number, number][],
    (p) => new RoomPosition(p[0], p[1], ch.roomName)
  );
  extensions.sort((p) => p.getRangeApprox(pos));
  extensions.reverse();
  extensions.splice(15);
  const roadMaxApproxExt = _.map(
    extensions,
    (p) => addRoad(pos, p, ch.active, 1, true)[1]
  );

  let labLen = 50;
  const lab = ch.active.posCell[prefix.laboratoryCell];
  if (lab)
    labLen = addRoad(pos, { x: lab[0], y: lab[1] }, ch.active, 1, true)[1];

  let fastLen = 50;
  const fast = ch.active.posCell[prefix.fastRefillCell];
  if (fast)
    fastLen = addRoad(pos, { x: fast[0], y: fast[1] }, ch.active, 2, true)[1];

  let tower = 0;
  _.forEach(roomMatrix.compressed[STRUCTURE_TOWER]?.que || [], (p) => {
    if (p === PLANNER_STAMP_STOP) return;
    tower += addRoad(pos, { x: p[0], y: p[1] }, ch.active, 1, true)[1];
  });

  ch.active.metrics = {
    ramps: roomMatrix.compressed[STRUCTURE_RAMPART]?.len || 0,
    minDmg: _.min(calcTowerDmg(roomMatrix, ch.roomName)[1]),
    roadCont: addRoad(pos, ch.controller, ch.active, 1, true)[1],
    maxRoadExt: _.max(roadMaxApproxExt),
    roadLabs: labLen,
    roadFastRef: fastLen,
    sumRoadTower: tower,
    final: 0,
  };
  return calcMetric(ch.active.metrics);
}

export function calcMetric(me: PlannerMetrics) {
  let metric = 0;
  // can tollerate no more then 80 ramps
  metric += (1 - me.ramps / 80) * 60; // 0 -> 60
  // baseline is 3 towers full bunker
  metric += (me.minDmg / (TOWER_POWER_ATTACK * 3)) * 40; // 0 -> 40
  const addRoadMetric = (roadTime: number, avg = 1, coef = 1) => {
    // 0 -> 5
    metric += (1 - roadTime / avg / ROOM_DIMENTIONS) * 5 * coef;
  };
  // at all 0 -> 30 for roads
  addRoadMetric(me.sumRoadTower, PLANNER_TOWERS, 2);
  addRoadMetric(me.maxRoadExt);
  addRoadMetric(me.roadCont);
  addRoadMetric(me.roadLabs);
  addRoadMetric(me.roadFastRef);
  me.final = Math.round(metric * 1000) / 1000;
  return metric;
}
