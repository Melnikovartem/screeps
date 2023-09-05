import { PLANNER_STAMP_STOP } from "antBrain/hivePlanner/plannerActive";

export function defenseWalls(hiveName: string) {
  const ans: (StructureWall | StructureRampart)[] = [];
  const planner = Memory.longterm.roomPlanner[hiveName]?.rooms[hiveName];
  if (!planner) return [];
  const walls = (planner.constructedWall && planner.constructedWall) || [];
  const ramps = (planner.rampart && planner.rampart) || [];
  _.forEach(walls, (p) => {
    if (p === PLANNER_STAMP_STOP) return;
    const pos = new RoomPosition(p[0], p[1], hiveName);
    const s = pos
      .lookFor(LOOK_STRUCTURES)
      .filter((isW) => isW.structureType === STRUCTURE_WALL)[0];
    if (s) ans.push(s as StructureWall);
  });
  _.forEach(ramps, (p) => {
    if (p === PLANNER_STAMP_STOP) return;
    const pos = new RoomPosition(p[0], p[1], hiveName);
    const s = pos
      .lookFor(LOOK_STRUCTURES)
      .filter((isR) => isR.structureType === STRUCTURE_RAMPART)[0];
    if (s) ans.push(s as StructureRampart);
  });
  return ans;
}
