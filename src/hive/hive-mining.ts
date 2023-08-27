import { prefix } from "static/enums";
import { makeId } from "static/utils";
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

export function updateAnnexes(this: Hive): void {
  const annexes = _.compact(
    _.map(this.annexNames, (annexName) => {
      const annex = Game.rooms[annexName];
      return annex;
    })
  );
  this.rooms = [this.room].concat(annexes);
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
  _.forEach(this.rooms, (room) => {
    _.forEach(room.find(FIND_SOURCES), (s) => {
      if (
        !s.pos
          .lookFor(LOOK_FLAGS)
          .filter(
            (f) =>
              f.color === COLOR_YELLOW &&
              (f.secondaryColor === COLOR_YELLOW ||
                f.secondaryColor === COLOR_RED)
          ).length
      ) {
        const flag = s.pos.createFlag(
          prefix.mine + makeId(2) + "_" + s.id.slice(s.id.length - 4),
          COLOR_YELLOW,
          COLOR_YELLOW
        );
        if (typeof flag === "string")
          Game.flags[flag].memory.hive = this.roomName;
      }
    });
  });

  _.forEach(this.rooms, (room) => {
    _.forEach(room.find(FIND_MINERALS), (s) => {
      if (
        room.name !== this.roomName &&
        !s.pos
          .lookFor(LOOK_STRUCTURES)
          .filter(
            (sIt) => sIt.structureType === STRUCTURE_EXTRACTOR && sIt.isActive()
          ).length
      )
        return;
      if (
        !s.pos
          .lookFor(LOOK_FLAGS)
          .filter(
            (f) =>
              f.color === COLOR_YELLOW &&
              (f.secondaryColor === COLOR_CYAN ||
                f.secondaryColor === COLOR_RED)
          ).length
      ) {
        const flag = s.pos.createFlag(
          prefix.mine + makeId(2) + "_" + s.id.slice(s.id.length - 4),
          COLOR_YELLOW,
          COLOR_CYAN
        );
        if (typeof flag === "string")
          Game.flags[flag].memory.hive = this.roomName;
      }
    });
  });
}
