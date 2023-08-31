import { PortalMaster } from "beeMasters/civil/portal";
import { PuppetMaster } from "beeMasters/civil/puppet";
import { prefix } from "static/enums";

import { FlagOrder } from "./order";

export function actUtilsActions(order: FlagOrder) {
  switch (order.secondaryColor) {
    case COLOR_BROWN: {
      const parsed = /^(sell|buy)_([A-Za-z0-9]*)?/.exec(order.ref);
      const res = parsed && (parsed[2] as ResourceConstant);
      const mode = parsed && parsed[1];
      order.acted = false;
      if (!Apiary.useBucket) break;
      if (
        res &&
        mode &&
        order.hiveName === order.pos.roomName &&
        order.hive.cells.storage &&
        order.hive.cells.storage.terminal
      ) {
        const fast = order.ref.includes("fast");
        if ("all" === parsed[2]) {
          if (mode === "sell") {
            // if (hurry || Game.time % 10 === 0)
            Apiary.broker.update();
            const getAmount = (res?: ResourceConstant) =>
              order.hive.cells.storage!.storage.store.getUsedCapacity(res) +
              order.hive.cells.storage!.terminal!.store.getUsedCapacity(res);
            _.forEach(
              Object.keys(order.hive.cells.storage.storage.store).concat(
                Object.keys(order.hive.cells.storage.terminal.store)
              ),
              (ress) => {
                const res = ress as ResourceConstant;
                if (
                  res === RESOURCE_ENERGY &&
                  getAmount() - getAmount(RESOURCE_ENERGY) >
                    2 * getAmount(RESOURCE_ENERGY)
                )
                  return;
                // get rid of shit in order hive
                Apiary.broker.sellOff(
                  order.hive.cells.storage!.terminal!,
                  res,
                  Math.min(5000, getAmount(res)),
                  order.hive.cells.defense.isBreached
                );
              }
            );
          } else order.delete();
          return;
        }
        const [low, high, avg] = Apiary.broker.priceSpread(res);
        if (RESOURCES_ALL.includes(res)) {
          if (Game.time === Apiary.createTime)
            console.log(
              `@ ${order.hive.print} : ${mode} ${res} ${
                fast ? "fast" : " "
              } : ${low || avg} - ${high || avg}`
            );
          if (fast || Game.time % 10 === 0) {
            switch (mode) {
              case "sell":
                if (
                  order.hive.cells.storage.getUsedCapacity(res) +
                    order.hive.cells.storage.terminal.store.getUsedCapacity(
                      res
                    ) >
                  0
                ) {
                  Apiary.broker.sellOff(
                    order.hive.cells.storage.terminal,
                    res,
                    500,
                    fast
                  );
                  return;
                }
                break;
              case "buy":
                // @MARKETDANGER
                if (
                  (order.hive.resState[res] || 0) <= 0 ||
                  (avg <= 1000 && (order.hive.resState[res] || 0) < 1000) // can afford 100K credits stockpile
                ) {
                  Apiary.broker.buyIn(
                    order.hive.cells.storage.terminal,
                    res,
                    res === RESOURCE_ENERGY ? 16384 : 2048,
                    fast
                  );
                  return;
                }
                break;
            }
            if (order.ref.includes("nokeep")) order.delete();
          }
        } else order.delete();
      } else order.delete();
      break;
    }
    case COLOR_RED:
      if (!order.memory.extraInfo) order.memory.extraInfo = Game.time;
      order.acted = false;
      if (Game.time % 25 !== 0) break;
      if (
        (order.pos.roomName in Game.rooms &&
          !order.pos.lookFor(LOOK_STRUCTURES).length) ||
        order.memory.extraInfo + 5000 < Game.time
      )
        order.delete();
      break;
    case COLOR_PURPLE:
      if (!order.master) order.master = new PuppetMaster(order);
      break;
    case COLOR_BLUE:
      if (!order.master) order.master = new PortalMaster(order);
      break;
  }
}

export function actUtilsPositions(order: FlagOrder) {
  if (order.hiveName === order.pos.roomName) {
    let cellType = "";
    let action = () => {};
    switch (order.secondaryColor) {
      case COLOR_BROWN:
        cellType = prefix.excavationCell;
        action = () =>
          _.forEach(
            order.hive.cells.excavation.resourceCells,
            (cell) => (cell.restTime = cell.pos.getTimeForPath(order.hive.rest))
          );
        break;
      case COLOR_CYAN:
        cellType = prefix.laboratoryCell;
        break;
      case COLOR_WHITE:
        cellType = prefix.defenseCell;
        action = () =>
          _.forEach(
            order.hive.cells.excavation.resourceCells,
            (cell) => (cell.roadTime = cell.pos.getTimeForPath(order.hive.pos))
          );
        break;
      case COLOR_RED:
        cellType = prefix.powerCell;
        break;
      case COLOR_GREEN:
        cellType = prefix.fastRefillCell;
        break;
    }
    if (cellType) {
      if (!order.hive.cache.cells[cellType])
        order.hive.cache.cells[cellType] = {};
      order.hive.cache.cells.poss = {
        x: order.pos.x,
        y: order.pos.y,
      };
      action();
      if (Apiary.planner.activePlanning[order.hiveName]) {
        if (!Apiary.planner.activePlanning[order.hiveName].cellsCache[cellType])
          Apiary.planner.activePlanning[order.hiveName].cellsCache[cellType] = {
            poss: { x: order.pos.x, y: order.pos.y },
          };
        else
          Apiary.planner.activePlanning[order.hiveName].cellsCache[
            cellType
          ].poss = { x: order.pos.x, y: order.pos.y };
      }
    }
  }
  order.delete();
}
