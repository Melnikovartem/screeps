export function defenseWalls(roomName: string) {
  const ans: (StructureWall | StructureRampart)[] = [];
  const planner = Memory.cache.roomPlanner[roomName];
  const walls = (planner.constructedWall && planner.constructedWall.pos) || [];
  const ramps = (planner.rampart && planner.rampart.pos) || [];
  _.forEach(walls, (p) => {
    const pos = new RoomPosition(p.x, p.y, roomName);
    const s = pos
      .lookFor(LOOK_STRUCTURES)
      .filter((isW) => isW.structureType === STRUCTURE_WALL)[0];
    if (s) ans.push(s as StructureWall);
  });
  _.forEach(ramps, (p) => {
    const pos = new RoomPosition(p.x, p.y, roomName);
    const s = pos
      .lookFor(LOOK_STRUCTURES)
      .filter((isR) => isR.structureType === STRUCTURE_RAMPART)[0];
    if (s) ans.push(s as StructureRampart);
  });
  return ans;
}
