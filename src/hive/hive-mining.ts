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
export function markResources(hive: Hive) {
  const annexes = _.compact(
    _.map(hive.annexNames, (annexName) => {
      const annex = Game.rooms[annexName];
      return annex;
    })
  );
  const rooms = [hive.room].concat(annexes);

  _.forEach(rooms, (room) => {
    _.forEach(room.find(FIND_SOURCES), (s) => {
      const ref = prefix.resourceCells + s.id;
      if (!hive.cache.cells[ref]) hive.cache.cells[ref] = { poss: s.pos };
      console.log(hive.cache.cells[ref], hive.print, ref);
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
        if (!hive.cache.cells[ref]) hive.cache.cells[ref] = { poss: s.pos };
      }
    });
  });

  hive.allResources = false;
}

export function addResourceCells(hive: Hive) {
  let foundAll = true;
  _.forEach(Object.keys(hive.cache.cells), (cellRef) => {
    if (cellRef.slice(0, prefix.resourceCells.length) === "res") {
      // @RESORUCE_CELL_REF
      const resource = Game.getObjectById(
        cellRef.slice(prefix.resourceCells.length) as Id<Mineral | Source>
      );
      if (resource) hive.cells.excavation.addResource(resource);
      else foundAll = false;
    }
  });
  return foundAll;
}
