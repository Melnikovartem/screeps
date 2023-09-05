import { ERR_NO_VISION } from "static/constants";

import { addStamp, canAddStamp } from "./addStamps";
import { floodFill } from "./flood-fill";
import { minCutToExit } from "./min-cut";
import type { ActivePlan } from "./plannerActive";
import { STAMP_CORE } from "./stamps";
import { distanceTransform, ROOM_DIMENTIONS } from "./wall-dist";

const DIST_FROM_WALL = {
  idealHigh: 12,
  idealLow: 8,
  nonidealBelowMaxInRoom: -2,
};

export const PLANNER_COST = {
  road: 1,
  plain: 2,
  swamp: 10,
  structure: 255, // not rly an option
  wall: 255, // not rly an option
};
const TAKE_N_BEST = 16;

/* chain startingPos -> {
  for goodPosition
    addCore
    addLabs
    addControllerRoads
    addResRoads
}
*/
export class RoomPlanner {
  // #region Properties (2)

  private addStamp = addStamp;
  private canAddStamp = canAddStamp;

  public activePlanning: ActivePlan | undefined;

  // #endregion Properties (2)

  // #region Public Methods (1)

  public createPlan(roomName: string) {
    const room = Game.rooms[roomName];
    if (!room) return ERR_NO_VISION;
    const posCont = room.controller?.pos;
    if (!posCont) return ERR_INVALID_TARGET;

    const resourcesPos = room.find(FIND_SOURCES).map((r) => r.pos);
    const mineralsPos = room.find(FIND_MINERALS).map((r) => r.pos);
    const posInterest: Pos[] = [posCont]
      .concat(resourcesPos)
      .concat(mineralsPos);

    // add postion to check / road to exit to corridor ?

    Apiary.engine.addTask("planner " + roomName, () => {
      const positions = this.startingPos(roomName, posInterest);
      if (!positions) return;
      if (!this.activePlanning)
        this.activePlanning = {
          futureHiveName: roomName,
          controller: posCont,
          sources: resourcesPos,
          minerals: mineralsPos,
          movement: {},
          posCell: {},
          compressed: {},
        };
      if (!this.canAddStamp(positions[0], STAMP_CORE)) return;
      this.addStamp(positions[0], STAMP_CORE);
    });
    return OK;
  }

  // #endregion Public Methods (1)

  // #region Protected Methods (1)

  protected getTerrainCostMatrix(roomName: string) {
    const costMatrix = new PathFinder.CostMatrix();
    const terrain = Game.map.getRoomTerrain(roomName);
    // set terrain
    for (let x = 0; x < 50; ++x)
      for (let y = 0; y < 50; ++y) {
        let val = 1;
        switch (terrain.get(x, y)) {
          case TERRAIN_MASK_WALL:
            val = 255;
            break;
          case TERRAIN_MASK_SWAMP:
          case 0:
            val = 1;
            break;
        }
        costMatrix.set(x, y, val);
      }
    return costMatrix;
  }

  // #endregion Protected Methods (1)

  // #region Private Methods (3)

  private generateWalls(roomName: string) {
    const costMatrix = this.getTerrainCostMatrix(roomName);

    const basePos = new RoomPosition(25, 25, roomName);
    const posCont = Game.rooms[roomName]?.controller?.pos || basePos;
    const resources = Game.rooms[roomName].find(FIND_SOURCES).map((r) => r.pos);
    const minerals = Game.rooms[roomName].find(FIND_MINERALS).map((r) => r.pos);

    costMatrix.set(posCont.x, posCont.y, 1);

    const posToProtect: Pos[] = [posCont].concat(resources).concat(minerals);

    const ramps = minCutToExit(posToProtect, costMatrix);
    const vis = () => {
      const rv = new RoomVisual(roomName);
      _.forEach(ramps, (r) => rv.structure(r.x, r.y, STRUCTURE_RAMPART));
    };
  }

  /** Keeps function in engine. Maybe move to engine */
  private keep(func: () => any) {
    return () => {
      func();
      return func;
    };
  }

  private startingPos(roomName: string, posInterest: Pos[]) {
    const costMatrix = this.getTerrainCostMatrix(roomName);

    const distanceMap = distanceTransform(costMatrix);
    let positions: [Pos, number][] = [];
    for (let x = 0; x < ROOM_DIMENTIONS; ++x)
      for (let y = 0; y < ROOM_DIMENTIONS; ++y)
        if (distanceMap.get(x, y) > 0)
          positions.push([{ x, y }, distanceMap.get(x, y)]);

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
    return _.map(positions, (p) => new RoomPosition(p[0].x, p[0].y, roomName));
  }

  // #endregion Private Methods (3)
}
