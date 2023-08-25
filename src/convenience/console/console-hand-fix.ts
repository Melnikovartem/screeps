import type { ReactionConstant } from "cells/stage1/laboratoryCell";
import { REACTION_MAP } from "cells/stage1/laboratoryCell";
import { signText } from "enums";

import { makeId } from "../../abstract/utils";
import { setups } from "../../bees/creepSetups";
import { CustomConsole } from "./console";

declare module "./console" {
  export interface CustomConsole {
    spawnDefender: (patternLimit: number, hiveName?: string) => string;
    spawnBuilder: (patternLimit: number, hiveName?: string) => string;
    spawnUpgrader: (patternLimit: number, hiveName?: string) => string;
    produce: (
      resource: ReactionConstant | CommodityConstant,
      hiveName?: string,
      amount?: number
    ) => string;
    sign: (textMy?: string, textAnnex?: string, textOther?: string) => string;
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
  hive.cells.defense.master.wish(
    { setup: destroyer, priority: 1 },
    "force_" + makeId(4)
  );
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
  if (!hive.builder) return `ERROR: NO BUILDER @ ${this.formatRoom(hiveName)}`;
  const builder = setups.builder.copy();
  builder.patternLimit = patternLimit;
  hive.builder.wish({ setup: builder, priority: 4 }, "force_" + makeId(4));
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
  if (hive.cells.upgrade.master.fastModePossible)
    upgrader = setups.upgrader.fast.copy();
  else upgrader = setups.upgrader.manual.copy();
  upgrader.patternLimit = patternLimit;
  hive.cells.upgrade.master.wish(
    { setup: upgrader, priority: 4 },
    "force_" + makeId(4)
  );
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
    hive.cells.lab.synthesizeTarget = {
      res: resource as ReactionConstant,
      amount,
    };
    hive.cells.lab.prod = undefined;
    hive.cells.lab.synthesizeRes = undefined;
    return `OK LAB @ ${hive.print}: ${resource} ${amount}`;
  } else if (COMMODITIES[resource as CommodityConstant]) {
    if (!hive.cells.factory) return `ERROR: FACTORY NOT FOUND @ ${hive.print}`;
    hive.cells.factory.commodityTarget = {
      res: resource as CommodityConstant,
      amount,
    };
    hive.cells.factory.prod = undefined;
    hive.cells.factory.commodityRes = undefined;
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
