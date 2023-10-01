import { setups } from "bees/creepSetups";
import type { ReactionConstant } from "cells/stage1/laboratoryCell";
import { REACTION_MAP } from "cells/stage1/laboratoryCell";
import { roomStates, signText } from "static/enums";

import { CustomConsole } from "./console";

declare module "./console" {
  export interface CustomConsole {
    // #region Properties (6)

    /**
     * Cleans up outdated intelligence data in a specific quadrant.
     * Saves intel data from the specified quadrant within the given square.
     * @param quadToclean - Quadrant to clean (e.g., "W0N0").
     * @param xmin - Minimum X coordinate for cleaning.
     * @param xmax - Maximum X coordinate for cleaning.
     * @param ymin - Minimum Y coordinate for cleaning.
     * @param ymax - Maximum Y coordinate for cleaning.
     */
    cleanIntel: (
      quadToclean: string,
      xmin: number,
      xmax: number,
      ymin: number,
      ymax: number
    ) => void;
    /**
     * Produces a resource using labs or factories in a hive.
     * @param resource - The resource to produce.
     * @param hiveName - Name of the hive to perform the production.
     * @param amount - Amount of the resource to produce.
     * @returns Result message of the production operation.
     */
    produce: (
      resource: ReactionConstant | CommodityConstant,
      hiveName?: string,
      amount?: number
    ) => string;
    /**
     * Signs controller rooms next to bees with claim.
     * Need to be called from time to time.
     * @param textMy - Text to sign controllers in your rooms.
     * @param textAnnex - Text to sign controllers in annexed rooms.
     * @param textOther - Text to sign controllers in other rooms.
     * @returns Result message of the signing operation.
     * @todo Automate this process.
     */
    sign: (textMy?: string, textAnnex?: string, textOther?: string) => string;
    /**
     * Spawns a builder creep in a hive.
     * @param patternLimit - Maximum number of patterns for the builder.
     * @param hiveName - Name of the hive to spawn the builder.
     * @returns Result message of the spawning operation.
     */
    spawnBuilder: (patternLimit: number, hiveName?: string) => string;
    /**
     * Spawns a defender creep in a hive.
     * @param patternLimit - Maximum number of patterns for the defender.
     * @param hiveName - Name of the hive to spawn the defender.
     * @returns Result message of the spawning operation.
     */
    spawnDefender: (patternLimit: number, hiveName?: string) => string;
    /**
     * Spawns an upgrader creep in a hive.
     * @param patternLimit - Maximum number of patterns for the upgrader.
     * @param hiveName - Name of the hive to spawn the upgrader.
     * @returns Result message of the spawning operation.
     */
    spawnUpgrader: (patternLimit: number, hiveName?: string) => string;

    // #endregion Properties (6)
  }
}

CustomConsole.prototype.spawnDefender = function (
  patternLimit = Infinity,
  hiveName
) {
  if (hiveName === undefined) hiveName = this.lastActionRoomName;
  hiveName = this.format(hiveName);
  const hive = Apiary.hives[hiveName];
  if (!hive) return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
  this.lastActionRoomName = hive.roomName;
  const destroyer = setups.defender.destroyer.copy();
  destroyer.patternLimit = patternLimit;
  hive.cells.defense.master.wish({ setup: destroyer, priority: 1 });
  return `DEFENDER SPAWNED @ ${this.formatRoom(hiveName)}`;
};

CustomConsole.prototype.spawnBuilder = function (
  patternLimit = Infinity,
  hiveName
) {
  if (hiveName === undefined) hiveName = this.lastActionRoomName;
  hiveName = this.format(hiveName);
  const hive = Apiary.hives[hiveName];
  if (!hive) return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
  this.lastActionRoomName = hive.roomName;
  if (!hive.cells.build)
    return `ERROR: NO BUILDER @ ${this.formatRoom(hiveName)}`;
  const builder = setups.builder.copy();
  builder.patternLimit = patternLimit;
  // hive.cells.build.master.wish({ setup: builder, priority: 4 });
  return `BUILDER SPAWNED @ ${this.formatRoom(hiveName)}`;
};

CustomConsole.prototype.spawnUpgrader = function (
  patternLimit = Infinity,
  hiveName
) {
  if (hiveName === undefined) hiveName = this.lastActionRoomName;
  hiveName = this.format(hiveName);
  const hive = Apiary.hives[hiveName];
  if (!hive) return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
  this.lastActionRoomName = hive.roomName;
  if (!hive.cells.upgrade)
    return `ERROR: NO UPGRADE CELL @ ${this.formatRoom(hiveName)}`;
  let upgrader;
  if (hive.cells.upgrade.fastModePossible)
    upgrader = setups.upgrader.fast.copy();
  else upgrader = setups.upgrader.manual.copy();
  upgrader.patternLimit = patternLimit;
  hive.cells.upgrade.master.wish({ setup: upgrader, priority: 4 });
  return `UPGRADER SPAWNED @ ${this.formatRoom(hiveName)}`;
};

CustomConsole.prototype.produce = function (
  resource: ReactionConstant | CommodityConstant,
  hiveName,
  amount = 10000
) {
  if (hiveName === undefined) hiveName = this.lastActionRoomName;
  hiveName = hiveName.toUpperCase();

  const hive = Apiary.hives[hiveName];
  if (!hive) return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
  this.lastActionRoomName = hive.roomName;
  if (REACTION_MAP[resource as ReactionConstant]) {
    if (!hive.cells.lab) return `ERROR: LAB NOT FOUND @ ${hive.print}`;
    hive.cells.lab.invalidateTarget();
    hive.cells.lab.synthesizeTarget = {
      res: resource as ReactionConstant,
      amount,
    };
    return `OK LAB @ ${hive.print}: ${resource} ${amount}`;
  } else if (COMMODITIES[resource as CommodityConstant]) {
    if (!hive.cells.factory) return `ERROR: FACTORY NOT FOUND @ ${hive.print}`;
    hive.cells.factory.invalidateTarget();
    hive.cells.factory.commodityTarget = {
      res: resource as CommodityConstant,
      amount,
    };
    return `OK FACTORY @ ${hive.print}: ${resource} ${amount}`;
  }
  return `ERROR: NOT A VALID COMPOUND ${resource}`;
};

CustomConsole.prototype.sign = function (
  textMy = signText.my,
  textAnnex = signText.annex,
  textOther = signText.other
) {
  const sgn = [];
  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    if (!creep.getBodyParts(CLAIM)) continue;
    const controller = creep.pos
      .findInRange(FIND_STRUCTURES, 1)
      .filter((s) => s.structureType === STRUCTURE_CONTROLLER)[0] as
      | StructureController
      | undefined;
    if (!controller) continue;

    let text = textOther;
    if (controller.my) text = textMy;
    else if (
      controller.reservation &&
      controller.reservation.username === Apiary.username
    )
      text = textAnnex;
    const ans = creep.signController(controller, text);
    if (ans === OK) sgn.push(controller.pos.roomName + " " + text);
    else
      console.log(
        `ERROR @ ${this.formatRoom(controller.pos.roomName)}: ${ans}`
      );
  }
  return (
    `SIGNED ${sgn.length} controllers${sgn.length ? "\n" : ""}` + sgn.join("\n")
  );
};

CustomConsole.prototype.cleanIntel = function (
  quadToclean: string,
  xmin: number,
  xmax: number,
  ymin: number,
  ymax: number
) {
  const quad = /^([WE])([NS])$/.exec(quadToclean);
  for (const roomName in Memory.cache.intel) {
    const parsed = /^([WE])([0-9]+)([NS])([0-9]+)$/.exec(roomName);
    if (parsed && quad) {
      const [, we, x, ns, y] = parsed;
      const state = Apiary.intel.getInfo(roomName, Infinity).roomState;
      if (
        we === quad[1] &&
        ns === quad[2] &&
        (+x < xmin ||
          +x > xmax ||
          +y < ymin ||
          +y > ymax ||
          (state > roomStates.reservedByMe &&
            state < roomStates.reservedByEnemy))
      )
        delete Memory.cache.intel[roomName];
      else console.log("SAVED INTEL FROM", this.formatRoom(roomName), "\n");
    } else delete Memory.cache.intel[roomName];
  }
};
