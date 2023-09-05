import { ROOM_DIMENTIONS } from "static/constants";

import { surroundingPoints } from "./min-cut";
import type { ActivePlan, RoomPlannerMatrix } from "./planner-active";
import { addStructure, PLANNER_COST } from "./planner-utils";

const PLANNER_MAX_ROOMS = 10;

export function addRoad(
  from: RoomPosition,
  to: RoomPosition | Pos,
  ap: ActivePlan,
  range = 1
) {
  let target: RoomPosition;
  if ("roomName" in to) target = to;
  else target = new RoomPosition(to.x, to.y, from.roomName);
  const path = PathFinder.search(
    from,
    { pos: target, range },
    {
      maxRooms: PLANNER_MAX_ROOMS,
      plainCost: PLANNER_COST.plain,
      swampCost: PLANNER_COST.swamp,
      roomCallback: (roomName) => {
        if (!ap.rooms[roomName]) ap.rooms[roomName] = initMatrix(roomName);
        return ap.rooms[roomName].movement;
      },
    }
  );
  _.forEach(path.path, (pos) => {
    const roads = ap.rooms[pos.roomName]?.compressed[STRUCTURE_ROAD]?.que || [];
    if (_.filter(roads, (r) => r[0] === pos.x && r[1] === pos.y).length) return;
    addStructure(pos, STRUCTURE_ROAD, ap.rooms[pos.roomName]);
  });
  return path.incomplete ? ERR_NOT_IN_RANGE : OK;
}

export function initMatrix(roomName: string): RoomPlannerMatrix {
  const [noExits, withExits] = getTerrainCostMatrix(roomName);
  return {
    compressed: {},
    building: withExits,
    movement: noExits,
  };
}

function getTerrainCostMatrix(roomName: string): [CostMatrix, CostMatrix] {
  const costMatrix = new PathFinder.CostMatrix();
  const terrain = Game.map.getRoomTerrain(roomName);
  // set terrain
  for (let x = 0; x < 50; ++x)
    for (let y = 0; y < 50; ++y) {
      let val = PLANNER_COST.wall;
      switch (terrain.get(x, y)) {
        case TERRAIN_MASK_WALL:
          val = PLANNER_COST.wall;
          break;
        case TERRAIN_MASK_SWAMP:
          val = PLANNER_COST.swamp;
          break;
        case 0:
          val = PLANNER_COST.plain;
          break;
      }
      costMatrix.set(x, y, val);
    }
  const noExits = costMatrix.clone();
  const addExit = (x: number, y: number) => {
    if (terrain.get(x, y) === PLANNER_COST.wall) return;
    _.forEach(surroundingPoints({ x, y }), (p) =>
      costMatrix.set(p.x, p.y, PLANNER_COST.wall)
    );
  };
  for (let x = 0; x < ROOM_DIMENTIONS; ++x) {
    addExit(x, 0);
    addExit(x, ROOM_DIMENTIONS - 1);
  }
  for (let y = 0; y < ROOM_DIMENTIONS; ++y) {
    addExit(0, y);
    addExit(ROOM_DIMENTIONS - 1, y);
  }
  return [noExits, costMatrix];
}
