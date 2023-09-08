import type { Cell } from "cells/_Cell";
import { prefix } from "static/enums";

import type { FlagCommand } from "./flagCommands";
import { SWARM_MASTER } from "./swarmOrder-masters";

export function actUtilsActions(command: FlagCommand) {
  switch (command.secondaryColor) {
    case COLOR_BROWN: {
      const parsed = /^(sell|buy)_([A-Za-z0-9]*)?/.exec(command.ref);
      const res = parsed && (parsed[2] as ResourceConstant);
      const mode = parsed && parsed[1];
      command.acted = false;
      if (!Apiary.useBucket) break;
      const sCell = command.hive.cells.storage;
      if (
        res &&
        mode &&
        command.hiveName === command.pos.roomName &&
        sCell.storage &&
        sCell.terminal
      ) {
        const fast = command.ref.includes("fast");
        const [low, high, avg] = Apiary.broker.priceSpread(res);
        if (RESOURCES_ALL.includes(res)) {
          if (Game.time === Apiary.createTime)
            console.log(
              `@ ${command.hive.print} : ${mode} ${res} ${
                fast ? "fast" : " "
              } : ${low || avg} - ${high || avg}`
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
                  (command.hive.resState[res] || 0) <= 0 ||
                  (avg <= 1000 && (command.hive.resState[res] || 0) < 1000) // can afford 100K credits stockpile
                ) {
                  const toBuy = res === RESOURCE_ENERGY ? 16384 : 2048;
                  Apiary.broker.buyIn(sCell.terminal, res, toBuy, fast);
                }
                break;
            }
          }
        } else command.delete();
      } else command.delete();
      break;
    }
    case COLOR_RED:
      command.acted = false;
      if (Game.time % 25 !== 0) break;
      if (
        (command.pos.roomName in Game.rooms &&
          !command.pos.lookFor(LOOK_STRUCTURES).length) ||
        command.createTime + 5000 < Game.time
      )
        command.delete();
      break;
    case COLOR_PURPLE:
      if (!Game.rooms[command.pos.roomName]) {
        command.acted = false;
        Apiary.oracle.requestSight(command.pos.roomName);
      }
      break;
    case COLOR_BLUE:
      command.createSwarm(SWARM_MASTER.portal);
      break;
  }
}

export function actUtilsPositions(command: FlagCommand) {
  if (command.hiveName !== command.pos.roomName) return;
  const hive = command.hive;
  let cell: Cell | undefined;
  let cellCache: string | undefined;

  let action = () => {};
  switch (command.secondaryColor) {
    case COLOR_YELLOW:
      cell = hive.cells.excavation;
      cellCache = prefix.excavationCell;
      action = () =>
        _.forEach(command.hive.cells.excavation.resourceCells, (resCell) =>
          resCell.updateRoadTime(true)
        );
      break;
    case COLOR_CYAN:
      cell = hive.cells.lab;
      cellCache = prefix.laboratoryCell;
      break;
    case COLOR_WHITE:
      cell = hive.cells.defense;
      cellCache = prefix.defenseCell;
      action = () =>
        _.forEach(command.hive.cells.excavation.resourceCells, (resCell) =>
          resCell.updateRoadTime(true)
        );
      break;
    case COLOR_RED:
      cell = hive.cells.power;
      cellCache = prefix.powerCell;
      break;
    case COLOR_GREEN:
      cell = hive.cells.spawn.fastRef;
      cellCache = prefix.fastRefillCell;
      break;
  }
  if (!cellCache && cell) cellCache = cell.refCache;
  if (!cellCache) return;

  const poss = {
    x: command.pos.x,
    y: command.pos.y,
  };
  if (!command.hive.cache.cells[cellCache])
    command.hive.cache.cells[cellCache] = {};
  command.hive.cache.cells.poss = poss;

  if (!cell) return;
  if ("poss" in cell) cell.poss = poss;
  action();

  const ch = Apiary.colony.planner.checking;
  if (!ch || ch.positions.length > 1) return;

  ch.best.posCell[cell.refCache] = [poss.x, poss.y];
  ch.active.posCell[cell.refCache] = [poss.x, poss.y];
}
