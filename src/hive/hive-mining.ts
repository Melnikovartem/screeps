import { Cell } from "cells/_Cell";
import { prefix, roomStates } from "static/enums";
import { Traveler } from "Traveler/TravelerModified";

import { Hive } from "./hive";

/**
 * Add an annex to the hive
 * @param {string} annexName - The name of the annex to add
 */
export function addAnex(this: Hive, annexName: string) {
  if (!this.annexNames.includes(annexName)) this.annexNames.push(annexName);
  if (this.cells.dev) this.cells.dev.shouldRecalc = true;
  if (this.shouldRecalc < 3) this.shouldRecalc = 3;
}

export function updateDangerAnnex(this: Hive) {
  this.annexInDanger = [];
  _.forEach(this.annexNames, (annexName) => {
    const path = Traveler.findRoute(this.roomName, annexName);
    if (path)
      for (const roomName in path) {
        if (roomName === this.roomName) continue;
        if (
          !Apiary.intel.getInfo(roomName, 25).safePlace &&
          (!Apiary.hives[roomName] ||
            Apiary.hives[roomName].cells.defense.isBreached)
        ) {
          this.annexInDanger.push(annexName);
          return;
        }
      }
  });
}

// actually needs to be done only once, but well couple times each reboot is (not) worst scenario
export function markResources(this: Hive) {
  const annexes = _.compact(
    _.map(this.annexNames, (annexName) => {
      const annex = Game.rooms[annexName];
      return annex;
    })
  );
  const rooms = [this.room].concat(annexes);

  _.forEach(rooms, (room) => {
    _.forEach(room.find(FIND_SOURCES), (s) => {
      const ref = Cell.refToCacheName(prefix.resourceCells + s.id);
      if (!this.cache.cells[ref]) this.cache.cells[ref] = {};
    });
  });

  _.forEach(rooms, (room) => {
    const roomState = Apiary.intel.getRoomState(this.pos);
    _.forEach(room.find(FIND_MINERALS), (s) => {
      if (
        room.name === this.roomName ||
        roomState === roomStates.SKcentral ||
        roomState === roomStates.SKfrontier
      ) {
        const ref = Cell.refToCacheName(prefix.resourceCells + s.id);
        if (!this.cache.cells[ref]) this.cache.cells[ref] = {};
      }
    });
  });
}
