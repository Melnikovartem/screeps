import { COMMON_COMMODITIES } from "cells/stage1/factoryCell";
import type { ResTarget } from "hive/hive-declarations";

import { TERMINAL_ENERGY } from "../cells/management/storageCell";
import {
  BASE_MINERALS,
  USEFUL_MINERAL_STOCKPILE,
} from "../cells/stage1/laboratoryCell";
import type { Hive } from "../hive/hive";
import { profile } from "../profiler/decorator";
import { hiveStates } from "../static/enums";
import { addResDict } from "../static/utils";

const PADDING_RESOURCE = MAX_CREEP_SIZE * LAB_BOOST_MINERAL;
/** keep free 100_000 slots free */
export const FREE_CAPACITY = STORAGE_CAPACITY * 0.1;
/** dump everything / stop drop until have 10_000 slots free */
export const FULL_CAPACITY = STORAGE_CAPACITY * 0.01;
/**  do not sell mare per transaction */
const SELL_STEP_MAX = 4096; // 8192 // careful about selling boosts
/** sell for profit if more than this */
const SELL_THRESHOLD = {
  compound: 4096,
  commodities: 1,
};

@profile
export class Network {
  // #region Properties (4)

  private commoditiesToSell: CommodityConstant[] = [];

  public aid: {
    [hiveNameFrom: string]: {
      to: string;
      res: ResourceConstant;
      amount: number;
      excess?: number;
    };
  } = {};
  public nodes: Hive[] = [];
  // from -> to
  public resState: ResTarget = {};

  // #endregion Properties (4)

  // #region Public Methods (7)

  public askAid(hive: Hive) {
    if (!this.hiveValidForAid(hive)) return;
    hive.shortages = {};

    for (const r in hive.resState) {
      const res = r as ResourceConstant;
      if (hive.resState[res]! < 0) {
        let validHives = _.filter(
          this.nodes,
          (h) =>
            h.roomName !== hive.roomName &&
            h.state === hiveStates.economy &&
            this.calcAmount(h.roomName, hive.roomName, res) > 0
        ).map((h) => h.roomName);
        const sendCost = (h: string) =>
          Game.market.calcTransactionCost(100000, hive.roomName, h) / 100000;
        if (res === RESOURCE_ENERGY)
          validHives = validHives.filter((h) => sendCost(h) < 0.31); // 11 or less roomDist
        if (validHives.length) {
          const validHive = validHives.reduce((prev, curr) =>
            hive.pos.getRoomRangeTo(curr, "lin") <
            hive.pos.getRoomRangeTo(prev, "lin")
              ? curr
              : prev
          );
          const amount = this.calcAmount(validHive, hive.roomName, res);
          if (this.aid[validHive] && this.aid[validHive].amount > amount)
            continue;
          this.aid[validHive] = {
            to: hive.roomName,
            res,
            amount,
          };
          break;
        } else hive.shortages[res] = -hive.resState[res]!;
      }
    }

    if (!hive.cells.storage.terminal) return;
    if (hive.cells.storage.storageFreeCapacity() >= FREE_CAPACITY) return;
    if (!this.aid[hive.roomName]) return;

    // store shit somewhere else
    const emptyHive = _.filter(
      this.nodes,
      (h) =>
        h.roomName !== hive.roomName &&
        h.cells.storage.storageFreeCapacity() > FREE_CAPACITY * 1.5 &&
        h.resState[RESOURCE_ENERGY] >= -h.resTarget[RESOURCE_ENERGY] * 0.5
    )[0];
    if (emptyHive) {
      const keys = Object.keys(hive.resState) as (keyof ResTarget)[];
      if (keys.length) {
        const res = keys.reduce((prev, curr) =>
          hive.resState[curr]! > hive.resState[prev]! ? curr : prev
        );
        if (hive.resState[res]! > 0)
          this.aid[hive.roomName] = {
            to: emptyHive.roomName,
            res,
            amount: FREE_CAPACITY * 0.1,
            excess: 1,
          };
      }
    }
  }

  public calcAmount(from: string, to: string, res: ResourceConstant) {
    let fromState = Apiary.hives[from].resState[res];
    const inProcess =
      this.aid[from] && this.aid[from].to === to && this.aid[from].res === res
        ? this.aid[from].amount
        : 0;
    let padding = 0;

    if (res === RESOURCE_ENERGY) padding = PADDING_RESOURCE;

    if (fromState === undefined) fromState = inProcess;
    else fromState = fromState - padding + inProcess;

    let toState = Apiary.hives[to].resState[res];
    if (toState === undefined) toState = 0;
    else toState = -toState + padding;

    return Math.max(Math.min(toState, fromState, 50000), 0);
  }

  public hiveValidForAid(hive: Hive) {
    const sCell = hive.cells.storage;
    return (
      sCell &&
      sCell.terminal &&
      !hive.cells.defense.isBreached &&
      !(
        sCell.terminal.effects &&
        sCell.terminal.effects.filter((e) => e.effect === PWR_DISRUPT_TERMINAL)
      )
    );
  }

  public init() {
    this.nodes = _.filter(
      Apiary.hives,
      (h) => h.cells.storage && h.cells.storage.terminal
    );
    _.forEach(this.nodes, (node) => {
      Apiary.broker.shortOrdersSell[node.roomName] = {
        orders: {},
        lastUpdated: Game.time,
      };
    });
    for (const [comm, commInfo] of Object.entries(COMMODITIES))
      if (
        commInfo.level === Apiary.maxFactoryLvl &&
        !COMMON_COMMODITIES.includes(comm as CommodityConstant)
      )
        this.commoditiesToSell.push(comm as CommodityConstant);
  }

  public run() {
    // to be able to save some cpu on buyIns

    for (const hive of this.nodes) {
      if (!hive.cells.storage || !hive.cells.storage.terminal) continue;
      const terminal = hive.cells.storage.terminal;
      let usedTerminal = false;
      let ans: "no money" | "long" | "short" = "no money";
      for (const r in hive.shortages) {
        const res = r as ResourceConstant;
        if (this.canHiveBuy(hive, res)) {
          const amount = hive.shortages[res]!;
          ans = Apiary.broker.buyIn(
            terminal,
            res,
            amount + PADDING_RESOURCE,
            hive.getUsedCapacity(res) <= LAB_BOOST_MINERAL * 2 // 60
          );
          if (ans === "short") {
            usedTerminal = true;
            break;
          }
        }
      }
      if (usedTerminal) continue;

      const aid = this.aid[hive.roomName];
      if (aid && !terminal.cooldown) {
        const sCellTo = Apiary.hives[aid.to].cells.storage;
        const terminalTo = sCellTo && sCellTo.terminal;
        if (terminalTo) {
          const energyCost =
            Game.market.calcTransactionCost(10000, hive.roomName, aid.to) /
            10000;
          const terminalEnergy =
            terminal.store.getUsedCapacity(RESOURCE_ENERGY);
          const energyCap = Math.floor(terminalEnergy / energyCost);
          let amount = Math.min(
            aid.amount,
            terminal.store.getUsedCapacity(aid.res),
            energyCap,
            terminalTo.store.getFreeCapacity(aid.res)
          );

          if (
            aid.res === RESOURCE_ENERGY &&
            amount * (1 + energyCost) > terminalEnergy
          )
            amount = Math.floor(amount * (1 - energyCost));

          if (amount > 0) {
            const ansTerminal = terminal.send(aid.res, amount, aid.to);
            if (ansTerminal === OK) {
              Apiary.logger.newTerminalTransfer(
                terminal,
                terminalTo,
                amount,
                aid.res
              );
              if (aid.excess) aid.amount -= amount;
            }
            continue;
          }
        }
      }

      for (const r in hive.mastersResTarget) {
        const res = r as ResourceConstant;
        const balanceShortage =
          hive.mastersResTarget[res]! - hive.getUsedCapacity(res);
        if (balanceShortage > 0 && this.canHiveBuy(hive, res)) {
          ans = Apiary.broker.buyIn(terminal, res, balanceShortage, true);
          if (ans === "short") {
            usedTerminal = true;
            break;
          }
        }
      }
      if (usedTerminal) continue;

      const stFree = hive.cells.storage.storageFreeCapacity();
      switch (hive.mode.sellOff) {
        case 2: {
          // sell for profit

          // sell some compound that are over stockpile
          for (const comp of Apiary.broker.profitableCompounds) {
            // could also check Object.keys(USEFUL_MINERAL_STOCKPILE) if want to sell only! those ones
            const compound = comp;
            const toSell =
              (hive.resState[compound] || 0) -
              (USEFUL_MINERAL_STOCKPILE[compound] || Infinity); // failsafe
            if (toSell >= SELL_THRESHOLD.compound) {
              ans = Apiary.broker.sellOff(
                terminal,
                compound,
                Math.min(SELL_STEP_MAX, toSell),
                stFree < FREE_CAPACITY // need to free some space
              );
            }
          }
          if (ans === "short") continue;

          // sell best mineral i can produce
          // @todo check all minerals and find most profitable
          const commoditiesToSellHive = _.filter(
            this.commoditiesToSell,
            (c) => (hive.resState[c] || 0) >= SELL_THRESHOLD.commodities
          );
          for (const commodity of commoditiesToSellHive) {
            ans = Apiary.broker.sellOff(
              terminal,
              commodity,
              Math.min(SELL_STEP_MAX, hive.resState[commodity] || 0)
            );
            if (ans === "short") continue;
          }
          // fall through
        }
        case 1: {
          // sell for free space
          // thought about storing best resources somewhere in the Apiary but rly too much trouble
          if (stFree > FREE_CAPACITY) break;
          const keys = Object.keys(hive.resState) as (keyof ResTarget)[];
          if (!keys.length) continue;
          const res = keys.reduce((prev, curr) =>
            hive.resState[curr]! > hive.resState[prev]! ? curr : prev
          );
          if (hive.resState[res]! < 0) break;
          ans = Apiary.broker.sellOff(
            terminal,
            res,
            Math.min(SELL_STEP_MAX, hive.resState[res]! * 0.8), // sell some of the resource
            stFree < FULL_CAPACITY * 2 // getting close to no space (20_000)
          );
          break;
        }
        case 0:
          // dont sell
          break;
      }
    }
  }

  public update() {
    this.resState = {};
    Apiary.wrap(
      () => _.forEach(Apiary.hives, (hive) => this.updateState(hive)),
      "network_updateState",
      "update",
      Object.keys(Apiary.hives).length
    );

    if (Game.time !== Apiary.createTime)
      Apiary.wrap(
        () => _.forEach(this.nodes, (node) => this.askAid(node)),
        "network_askAid",
        "update",
        this.nodes.length
      );

    Apiary.wrap(
      () => {
        for (const hiveName in this.aid) {
          const hive = Apiary.hives[hiveName];
          const sCell = hive.cells.storage;
          if (!sCell) continue;
          const aid = this.aid[hiveName];
          if (!aid.excess)
            aid.amount = this.calcAmount(hiveName, aid.to, aid.res);
          if (
            !this.hiveValidForAid(Apiary.hives[aid.to]) ||
            aid.amount <= 0 ||
            hive.state !== hiveStates.economy
          ) {
            delete this.aid[hiveName];
            continue;
          }
          addResDict(sCell.resTargetTerminal, aid.res, aid.amount);
        }
      },
      "network_planAid",
      "update",
      Object.keys(this.aid).length
    );
  }

  public updateState(hive: Hive) {
    hive.resState = { energy: 0 };
    const sCell = hive.cells.storage;
    if (!sCell) return;

    sCell.updateUsedCapacity();

    for (const [res, amount] of Object.entries(sCell.usedCapacity))
      addResDict(hive.resState, res, amount);

    if (hive.cells.lab) {
      for (const [res, amount] of Object.entries(hive.cells.lab.resTarget))
        addResDict(hive.resState, res, -amount);
      if (hive.cells.lab.prod) {
        addResDict(
          hive.resState,
          hive.cells.lab.prod.res1,
          -hive.cells.lab.prod.plan
        );
        addResDict(
          hive.resState,
          hive.cells.lab.prod.res2,
          -hive.cells.lab.prod.plan
        );
      }
    }

    if (hive.cells.factory)
      for (const [res, amount] of Object.entries(hive.cells.factory.resTarget))
        addResDict(hive.resState, res, -amount);

    for (const [res, amount] of Object.entries(hive.resTarget))
      addResDict(hive.resState, res, -amount);

    for (const [res, amount] of Object.entries(hive.mastersResTarget))
      addResDict(hive.resState, res, -amount);

    if (!sCell.terminal) return;

    let fullStorage = Math.min(
      1,
      Math.floor(sCell.getUsedCapacity(RESOURCE_ENERGY) / 1200) / 100 + 0.01
    );
    if (sCell.getUsedCapacity(RESOURCE_ENERGY) < 150000)
      fullStorage = Math.max(
        fullStorage / 2,
        Math.min(
          fullStorage,
          sCell.terminal.store.getUsedCapacity(RESOURCE_ENERGY) /
            TERMINAL_ENERGY
        )
      );

    sCell.resTargetTerminal = { energy: TERMINAL_ENERGY * fullStorage };

    if (hive.state !== hiveStates.battle)
      for (const [res, amount] of Object.entries(
        Apiary.broker.getTargetLongOrders(hive.roomName)
      ))
        addResDict(sCell.resTargetTerminal, res, Math.min(amount, 5000));

    const aid = this.aid[hive.roomName];
    if (aid) addResDict(sCell.resTargetTerminal, aid.res, aid.amount);

    for (const [res, amount] of Object.entries(hive.resState))
      addResDict(this.resState, res, amount);
  }

  // #endregion Public Methods (7)

  // #region Private Methods (1)

  private canHiveBuy(hive: Hive, res: ResourceConstant) {
    let canBuyIn = false;
    switch (hive.mode.buyIn) {
      case 3:
        canBuyIn = true;
        break;
      case 2:
        if (
          res === RESOURCE_ENERGY ||
          res === RESOURCE_OPS ||
          BASE_MINERALS.includes(res)
        )
          canBuyIn = true;
        break;
      case 1:
        if (BASE_MINERALS.includes(res)) canBuyIn = true;
        break;
      case 0:
        break;
    }
    return canBuyIn;
  }

  // #endregion Private Methods (1)
}
