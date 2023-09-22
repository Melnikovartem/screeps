import type { Cell } from "cells/_Cell";
import type { Hive } from "hive/hive";
import { prefix } from "static/enums";

import type { FlagCommand } from "./flagCommands";
import { SWARM_MASTER } from "./swarm-nums";

export function actUtilsActions(cm: FlagCommand) {
  switch (cm.secondaryColor) {
    case COLOR_BROWN: {
      const parsed = /^(sell|buy)_([A-Za-z0-9]*)?/.exec(cm.ref);
      const res = parsed && (parsed[2] as ResourceConstant);
      const mode = parsed && parsed[1];
      cm.acted = false;
      if (!Apiary.useBucket) break;
      const sCell = cm.hive.cells.storage;
      if (
        res &&
        mode &&
        cm.hiveName === cm.pos.roomName &&
        sCell.storage &&
        sCell.terminal
      ) {
        const fast = cm.ref.includes("fast");
        const [low, high, avg] = Apiary.broker.priceSpread(res);
        if (RESOURCES_ALL.includes(res)) {
          if (Game.time === Apiary.createTime)
            console.log(
              `@ ${cm.hive.print} : ${mode} ${res} ${fast ? "fast" : " "} : ${
                low || avg
              } - ${high || avg}`
            );
          if (fast || Game.time % 10 === 0) {
            switch (mode) {
              case "sell":
                if (
                  (sCell.storage.store.getUsedCapacity(res) || 0) +
                    sCell.terminal.store.getUsedCapacity(res) >
                  0
                )
                  Apiary.broker.sellOff(sCell.terminal, res, 500, fast);
                break;
              case "buy":
                // @MARKETDANGER
                if (
                  cm.hive.getResState(res) <= 0 ||
                  (avg <= 1000 && cm.hive.getResState(res) < 1000) // can afford 100K credits stockpile
                ) {
                  const toBuy = res === RESOURCE_ENERGY ? 16384 : 2048;
                  Apiary.broker.buyIn(sCell.terminal, res, toBuy, fast);
                }
                break;
            }
          }
        } else cm.delete();
      } else cm.delete();
      break;
    }
    case COLOR_ORANGE:
    case COLOR_RED:
      cm.acted = false;
      if (Game.time % 25 !== 0) break;
      if (
        (cm.pos.roomName in Game.rooms &&
          !cm.pos.lookFor(LOOK_STRUCTURES).length) ||
        cm.createTime + 5000 < Game.time
      )
        cm.delete();
      break;
    case COLOR_PURPLE:
      if (!Game.rooms[cm.pos.roomName]) {
        cm.acted = false;
        Apiary.oracle.requestSight(cm.pos.roomName);
      }
      break;
    case COLOR_BLUE:
      cm.createSwarm(SWARM_MASTER.portal);
      break;
  }
}

export function actUtilsPositions(cm: FlagCommand) {
  let hive: Hive | undefined;
  if (cm.hiveName === cm.pos.roomName) hive = cm.hive;
  let cell: Cell | undefined;
  let cellCache: string | undefined;

  let action = () => {};
  switch (cm.secondaryColor) {
    case COLOR_WHITE:
      // center of hive
      cell = hive && hive.cells.defense;
      cellCache = prefix.defenseCell;
      action = () =>
        _.forEach(cm.hive.cells.excavation.resourceCells, (resCell) =>
          resCell.updateRoadTime(true)
        );
      break;
    case COLOR_YELLOW:
      // rest pos of hive
      cell = hive && hive.cells.excavation;
      cellCache = prefix.excavationCell;
      action = () =>
        _.forEach(cm.hive.cells.excavation.resourceCells, (resCell) =>
          resCell.updateRoadTime(true)
        );
      break;
    case COLOR_CYAN:
      // labs center hive
      cell = hive && hive.cells.lab;
      cellCache = prefix.laboratoryCell;
      break;
    case COLOR_RED:
      // rest pos for power creeps hive
      cell = hive && hive.cells.power;
      cellCache = prefix.powerCell;
      break;
    case COLOR_BLUE:
      // fast ref cell hive
      cell = hive && hive.cells.spawn.fastRef;
      cellCache = prefix.fastRefillCell;
      break;
    case COLOR_GREEN:
      // upgrade link / container / storage (if max boost) in hive
      cellCache = prefix.upgradeCell;
      break;
  }
  if (!cellCache && cell) cellCache = cell.refCache;
  if (!cellCache) return;

  const poss = {
    x: cm.pos.x,
    y: cm.pos.y,
  };

  // update in hive cache
  if (hive) {
    if (!hive.cache.cells[cellCache]) hive.cache.cells[cellCache] = {};
    hive.cache.cells[cellCache].poss = poss;
  }

  // update in current hive
  if (cell) {
    if ("poss" in cell) cell.poss = poss;
    action();
  }

  const ch = Apiary.colony.planner.checking;
  if (ch) {
    // add to plan if plan active
    ch.best.posCell[cellCache] = [poss.x, poss.y];
    ch.active.posCell[cellCache] = [poss.x, poss.y];
  } else {
    // add to memory if no plan active
    const hivePlan = Memory.longterm.roomPlanner[cm.pos.roomName]?.posCell;
    if (hivePlan) hivePlan[cellCache] = [poss.x, poss.y];
  }
}
