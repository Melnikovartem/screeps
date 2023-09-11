import type { Hive } from "hive/hive";
import { ROOM_DIMENTIONS } from "static/constants";
import { prefix } from "static/enums";

import { addRoad, initMatrix } from "./addRoads";
import { addStampSomewhere } from "./addStamps";
import type { ActivePlan } from "./planner-active";
import {
  addStructure,
  calcTowerDmg,
  endBlock,
  getPos,
  PLANNER_STAMP_STOP,
  PLANNER_TOWERS,
} from "./planner-utils";
import type { RoomPlanner } from "./roomPlanner";
import { STAMP_REST } from "./stamps";

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

  const [allWalls, wallsDmg] = calcTowerDmg(roomMatrix, ch.roomName);
  const refCheck = _.map(
    _.filter(allWalls, (p) => p.getRangeTo(ch.controller) > 1),
    (w) => w.to_str
  );

  ch.active.metrics = {
    ramps:
      (roomMatrix.compressed[STRUCTURE_RAMPART]?.len || 0) +
      (roomMatrix.compressed[STRUCTURE_WALL]?.len || 0),
    minDmg: Math.round(
      _.min(_.filter(wallsDmg, (_, ref) => refCheck.includes(ref || "")))
    ),
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

export function currentToActive(this: RoomPlanner, hive: Hive, save = true) {
  const sources = _.map(
    _.filter(
      hive.cells.excavation.resourceCells,
      (c) => c.resType === RESOURCE_ENERGY
    ),
    (c) => c.resource?.pos || c.pos
  );
  const minerals = _.map(
    _.filter(
      hive.cells.excavation.resourceCells,
      (c) => c.resType !== RESOURCE_ENERGY
    ),
    (c) => c.resource?.pos || c.pos
  );
  this.initPlan(hive.roomName, hive.controller.pos, sources, minerals, save);
  if (!this.checking) return;
  const ap = this.checking.active;

  let x = hive.controller.pos.x;
  let y = hive.controller.pos.y;
  if (hive.storage) {
    x = hive.storage.pos.x;
    y = hive.storage.pos.y;
    if (hive.room.terminal) {
      x = Math.round((x + hive.room.terminal.pos.x) / 2);
      y = Math.round((y + hive.room.terminal.pos.y) / 2);
    }
  }
  let pos = new RoomPosition(x, y, hive.roomName);
  if (!pos.isFree()) pos = pos.getOpenPositions()[0] || pos;

  ap.centers = [pos];
  ap.posCell[prefix.defenseCell] = [pos.x, pos.y];

  for (const roomName of hive.allRoomNames) {
    const room = Game.rooms[roomName];
    if (!room) continue;
    ap.rooms[roomName] = initMatrix(roomName);
    // adding neutral structures in the room
    const structures = room.find(FIND_STRUCTURES);
    const constructions = room.find(FIND_CONSTRUCTION_SITES);
    _.forEach(
      (structures as (Structure | ConstructionSite)[]).concat(constructions),
      (s) => {
        addStructureFromReal(s, ap, roomName, hive.roomName);
        if (roomName === hive.roomName) addCellPos(s, ap);
      }
    );
    endBlock(this.checking.active);
  }
  addStampSomewhere(
    ap.centers,
    STAMP_REST,
    ap.rooms[hive.roomName],
    ap.posCell
  );
  this.recalcMetricsActive();
  this.checking.best = this.checking.active;
  if (save) {
    this.savePlan();
    this.invalidatePlan();
  }
}

function addStructureFromReal(
  s: Structure | ConstructionSite,
  ap: ActivePlan,
  roomName: string,
  hiveName: string
) {
  switch (s.structureType) {
    case STRUCTURE_CONTROLLER:
    case STRUCTURE_KEEPER_LAIR:
    case STRUCTURE_POWER_BANK:
    case STRUCTURE_INVADER_CORE:
    case STRUCTURE_PORTAL:
      break;
    case STRUCTURE_CONTAINER:
    case STRUCTURE_ROAD:
      addStructure(s.pos, s.structureType, ap.rooms[roomName]);
      break;
    default:
      // some strange types like controller keeper_lair and power_bank
      // in FIND_MY_STRUCTURES prob a bug with typescript
      if (roomName === hiveName)
        addStructure(s.pos, s.structureType, ap.rooms[roomName]);
  }
}

function addCellPos(s: Structure | ConstructionSite, ap: ActivePlan) {
  switch (s.structureType) {
    case STRUCTURE_POWER_SPAWN: {
      if (ap.posCell[prefix.powerCell]) break;
      let openPos = s.pos.getOpenPositions();
      const openPosNoRoad = openPos.filter(
        (p) => !p.lookFor(LOOK_STRUCTURES).length
      );
      if (openPosNoRoad.length) openPos = openPosNoRoad;
      if (openPos.length)
        ap.posCell[prefix.powerCell] = [openPos[0].x, openPos[0].y];
      break;
    }
    case STRUCTURE_CONTROLLER: {
      if (ap.posCell[prefix.upgradeCell]) break;
      const links = s.pos
        .findInRange(FIND_MY_STRUCTURES, 3)
        .filter((sp) => sp.structureType === STRUCTURE_LINK);
      if (links.length) {
        const linkCont = links.reduce((a, b) =>
          a.pos.getRangeApprox(s) <= b.pos.getRangeApprox(s) ? a : b
        );
        ap.posCell[prefix.upgradeCell] = [linkCont.pos.x, linkCont.pos.y];
      }
      break;
    }
    case STRUCTURE_LINK:
      {
        if (ap.posCell[prefix.fastRefillCell]) break;
        const refillNearBy = s.pos
          .findInRange(FIND_MY_STRUCTURES, 3)
          .filter(
            (sp) =>
              sp.structureType === STRUCTURE_EXTENSION ||
              sp.structureType === STRUCTURE_SPAWN
          ).length;
        const containersNearBy = s.pos
          .findInRange(FIND_STRUCTURES, 3)
          .filter((sp) => sp.structureType === STRUCTURE_CONTAINER).length;
        // could check all 3 + 15 = 18, but before max spawns no use so just the extension
        if (containersNearBy === 2 && refillNearBy >= 15)
          ap.posCell[prefix.fastRefillCell] = [s.pos.x, s.pos.y];
      }
      break;
    case STRUCTURE_LAB: {
      if (ap.posCell[prefix.laboratoryCell]) break;
      const openPos = s.pos.getOpenPositions();
      if (openPos.length) {
        const posMaxLabs = openPos.reduce((a, b) => {
          return a
            .findInRange(FIND_MY_STRUCTURES, 3)
            .filter((sp) => sp.structureType === STRUCTURE_LAB).length >=
            b
              .findInRange(FIND_MY_STRUCTURES, 3)
              .filter((sp) => sp.structureType === STRUCTURE_LAB).length
            ? a
            : b;
        });
        ap.posCell[prefix.laboratoryCell] = [posMaxLabs.x, posMaxLabs.y];
      }
      break;
    }
  }
}
