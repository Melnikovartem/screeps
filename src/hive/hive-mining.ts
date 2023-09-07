import { prefix, roomStates } from "static/enums";

import type { Hive } from "./hive";

// actually needs to be done only once, but well couple times each reboot is (not) worst scenario
export function markResources(hive: Hive) {
  const annexes = _.compact(
    _.map(hive.annexNames, (annexName) => Game.rooms[annexName])
  );
  const rooms = [hive.room].concat(annexes);

  const formatPos = (p: RoomPosition) =>
    p.roomName !== hive.roomName ? p : { x: p.x, y: p.y };

  _.forEach(rooms, (room) => {
    _.forEach(room.find(FIND_SOURCES), (s) => {
      const ref = prefix.resourceCells + s.id;
      if (!hive.cache.cells[ref])
        hive.cache.cells[ref] = { poss: formatPos(s.pos) };
    });
  });

  _.forEach(rooms, (room) => {
    const roomState = Apiary.intel.getRoomState(hive.pos);
    _.forEach(room.find(FIND_MINERALS), (s) => {
      if (
        room.name === hive.roomName ||
        roomState === roomStates.SKcentral ||
        roomState === roomStates.SKfrontier
      ) {
        const ref = prefix.resourceCells + s.id;
        if (!hive.cache.cells[ref])
          hive.cache.cells[ref] = { poss: formatPos(s.pos) };
      }
    });
  });

  hive.allResources = false;
}

export function addResourceCells(hive: Hive) {
  hive.allResources = true;
  let resourceCells = 0;
  _.forEach(Object.keys(hive.cache.cells), (cellRef) => {
    if (cellRef.slice(0, prefix.resourceCells.length) === "res") {
      ++resourceCells;
      // @RESORUCE_CELL_REF
      const resId = cellRef.slice(prefix.resourceCells.length) as Id<
        Mineral | Source
      >;
      if (hive.cells.excavation.resourceCells[resId]) return;
      const resource = Game.getObjectById(resId);
      if (resource) hive.cells.excavation.addResource(resource);
      else hive.allResources = false;
    }
  });
  // at least energy and 1 mineral :/
  if (resourceCells < 2) markResources(hive);
}
