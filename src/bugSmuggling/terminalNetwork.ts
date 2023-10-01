import { COMPLEX_COMMODITIES } from "cells/stage1/factoryCell";
import type { ResTarget } from "hive/hive-declarations";

import { HIVE_ENERGY, TERMINAL_ENERGY } from "../cells/management/storageCell";
import {
  BASE_MINERAL_STOCKPILE,
  BASE_MINERALS,
  PROFITABLE_MINERAL_STOCKPILE,
  USEFUL_MINERAL_STOCKPILE,
} from "../cells/stage1/laboratoryCell";
import type { Hive } from "../hive/hive";
import { profile } from "../profiler/decorator";
import { hiveStates } from "../static/enums";
import { addResDict } from "../static/utils";
import { MARKET_SETTINGS } from "./broker";

const PADDING_RESOURCE = MAX_CREEP_SIZE * LAB_BOOST_MINERAL;

export const FREE_CAPACITY = {
  /** keep free 100_000 slots free */
  min: STORAGE_CAPACITY * 0.1,
  /** dump everything / stop drop until have 50_000 slots free */
  max: STORAGE_CAPACITY * 0.05,
};
/**  do not sell mare per transaction */
const SELL_STEP_MAX = 4096; // 8192 // careful about selling boosts
/** sell for profit if more than this */
const SELL_THRESHOLD = {
  compound: 4096,
  commodities: 1,
  mineral: Math.min(4096, PROFITABLE_MINERAL_STOCKPILE - 500),
};

@profile
export class Network {
  // #region Properties (5)

  private commoditiesToSell: CommodityConstant[] = [];
  private resState: ResTarget = {};

  /** from -> to */
  public aid: {
    [hiveNameFrom: string]: {
      to: string;
      res: ResourceConstant;
      amount: number;
      excess?: number;
    };
  } = {};
  public nodes: Hive[] = [];
  public nodesTrading: Hive[] = [];

  // #endregion Properties (5)

  // #region Public Methods (4)

  public getResState(res: ResourceConstant) {
    return this.resState[res] || 0;
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
    for (const [commS, commInfo] of Object.entries(COMMODITIES)) {
      const comm = commS as CommodityConstant;
      if (
        commInfo.level === Apiary.maxFactoryLvl &&
        COMPLEX_COMMODITIES.includes(comm)
      )
        this.commoditiesToSell.push(comm);
    }
  }

  public run() {
    for (const hive of this.nodes) this.runHiveNode(hive);
  }

  public update() {
    this.resState = {};
    Apiary.wrap(
      () => _.forEach(Apiary.hives, (hive) => this.updateStateHive(hive)),
      "network_updateState",
      "update",
      Object.keys(Apiary.hives).length
    );

    /** wait some time before start sending stuff / buying stuff */
    if (Apiary.intTime > 10)
      Apiary.wrap(
        () => _.forEach(this.nodes, (node) => this.updateAskAid(node)),
        "network_askAid",
        "update",
        this.nodes.length
      );

    Apiary.wrap(
      () => this.updatePlanAid(),
      "network_planAid",
      "update",
      Object.keys(this.aid).length
    );
  }

  // #endregion Public Methods (4)

  // #region Private Methods (9)

  private buyShortages(
    hive: Hive,
    terminal: StructureTerminal
  ): "usedTerminal" | undefined {
    const creditsToUse = Apiary.broker.creditsToUse();

    for (const r in hive.shortages) {
      const res = r as ResourceConstant;
      if (!hive.canBuy(res)) continue;
      switch (res) {
        case RESOURCE_ENERGY:
          if (creditsToUse < MARKET_SETTINGS.energyCredits) continue;
          break;
        case RESOURCE_OPS:
          if (creditsToUse < MARKET_SETTINGS.opsCredits) continue;
          break;
        default:
          if (BASE_MINERALS.includes(res)) {
            if (creditsToUse < MARKET_SETTINGS.mineralCredits) continue;
            break;
          }
          if (Object.keys(USEFUL_MINERAL_STOCKPILE).includes(res)) {
            if (creditsToUse < MARKET_SETTINGS.boostCredits) continue;
            break;
          }
          if (creditsToUse < MARKET_SETTINGS.anyCredits) continue;
      }

      const amount = hive.shortages[res]!;
      const ans = Apiary.broker.buyIn(
        terminal,
        res,
        amount + PADDING_RESOURCE,
        hive.getUsedCapacity(res) <= LAB_BOOST_MINERAL * 2 // 60
      );
      if (ans === "short") return "usedTerminal";
    }
    return undefined;
  }

  private calcAmount(from: string, to: string, res: ResourceConstant) {
    let fromState = Apiary.hives[from].getResState(res);
    const inProcess =
      this.aid[from] && this.aid[from].to === to && this.aid[from].res === res
        ? this.aid[from].amount
        : 0;
    let padding = 0;

    if (res === RESOURCE_ENERGY) padding = PADDING_RESOURCE;

    if (fromState === undefined) fromState = inProcess;
    else fromState = fromState - padding + inProcess;

    let toState = Apiary.hives[to].getResState(res);
    if (toState === undefined) toState = 0;
    else toState = -toState + padding;

    return Math.max(Math.min(toState, fromState, 50000), 0);
  }

  private hiveValidForAid(hive: Hive) {
    return !hive.cells.defense.isBreached && hive.cells.storage.terminalActive;
  }

  private runHiveNode(hive: Hive) {
    if (!hive.cells.storage || !hive.cells.storage.terminal) return;
    const terminal = hive.cells.storage.terminal;
    if (terminal.cooldown) return;

    if (this.buyShortages(hive, terminal) === "usedTerminal") return;

    const aid = this.aid[hive.roomName];
    if (aid) {
      const sCellTo = Apiary.hives[aid.to].cells.storage;
      const terminalTo = sCellTo && sCellTo.terminal;
      if (terminalTo) {
        const energyCost =
          Game.market.calcTransactionCost(10000, hive.roomName, aid.to) / 10000;
        const terminalEnergy = terminal.store.getUsedCapacity(RESOURCE_ENERGY);
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
          return;
        }
      }
    }

    const stFree = hive.cells.storage.storageFreeCapacity();
    switch (hive.mode.sellOff) {
      case 2: {
        // sell for profit

        // if need to free some space
        const sellFaster = stFree < FREE_CAPACITY.min;

        // sell minerals that are over some limit
        for (const mineral of BASE_MINERALS) {
          const toSell =
            hive.getResState(mineral) - BASE_MINERAL_STOCKPILE.sellOff;
          if (toSell < SELL_THRESHOLD.mineral) continue;
          const ans = Apiary.broker.sellOff(
            terminal,
            mineral,
            Math.min(SELL_STEP_MAX, toSell),
            sellFaster
          );
          if (ans === "short") return;
        }

        // sell some compound that are over stockpile
        for (const comp of Apiary.broker.profitableCompounds) {
          // could also check Object.keys(USEFUL_MINERAL_STOCKPILE) if want to sell only! those ones
          const compound = comp;
          const toSell =
            hive.getResState(compound) -
            (USEFUL_MINERAL_STOCKPILE[compound] || Infinity); // failsafe
          if (toSell < SELL_THRESHOLD.compound) continue;
          const ans = Apiary.broker.sellOff(
            terminal,
            compound,
            Math.min(SELL_STEP_MAX, toSell),
            sellFaster
          );
          if (ans === "short") return;
        }

        // sell best mineral i can produce
        // @todo check all minerals and find most profitable
        const commoditiesToSellHive = _.filter(
          this.commoditiesToSell,
          (c) => hive.getResState(c) >= SELL_THRESHOLD.commodities
        );
        for (const commodity of commoditiesToSellHive) {
          const ans = Apiary.broker.sellOff(
            terminal,
            commodity,
            Math.min(SELL_STEP_MAX, hive.getResState(commodity))
          );
          if (ans === "short") return;
        }
        // fall through
      }
      case 1:
        {
          // sell for free space
          // thought about storing best resources somewhere in the Apiary but rly too much trouble
          if (stFree > FREE_CAPACITY.min) break;
          const keys = Object.keys(hive.resState) as (keyof ResTarget)[];
          if (!keys.length) return;
          const getSellingState = (resToSell: ResourceConstant) => {
            let offset = 0;
            // sell minerals and other stuff before energy
            if (resToSell === RESOURCE_ENERGY) offset = HIVE_ENERGY;
            return hive.getResState(resToSell) - offset;
          };
          const res = keys.reduce((prev, curr) =>
            getSellingState(curr) > getSellingState(prev) ? curr : prev
          );
          if (hive.getResState(res) <= 0) break;
          const ans = Apiary.broker.sellOff(
            terminal,
            res,
            Math.min(SELL_STEP_MAX, hive.getResState(res) * 0.8), // sell some of the resource
            stFree < FREE_CAPACITY.max * 2 // getting close to no space (20_000)
          );
          if (ans === "short") return;
        }
        break;
      case 0:
        // dont sell
        break;
    }
  }

  private storeExtraRes(hive: Hive) {
    if (!hive.cells.storage.terminal) return;
    if (hive.cells.storage.storageFreeCapacity() >= FREE_CAPACITY.min) return;
    if (!this.aid[hive.roomName]) return;

    const keys = Object.keys(hive.resState) as (keyof ResTarget)[];
    if (!keys.length) return;
    const res = keys.reduce((prev, curr) =>
      hive.getResState(curr) > hive.getResState(prev) ? curr : prev
    );
    const resIsValuable = res in [RESOURCE_POWER] || res in COMPLEX_COMMODITIES;

    if (!resIsValuable) return;
    if (hive.getResState(res) <= 0) return;

    // store shit somewhere else
    const emptyHive = _.filter(
      this.nodes,
      (h) =>
        h.roomName !== hive.roomName &&
        h.cells.storage.storageFreeCapacity() > FREE_CAPACITY.min * 1.5 &&
        h.getResState(RESOURCE_ENERGY) >= -h.resTarget[RESOURCE_ENERGY] * 0.5
    )[0];
    if (!emptyHive) return;

    this.aid[hive.roomName] = {
      to: emptyHive.roomName,
      res,
      amount: FREE_CAPACITY.min * 0.1,
      excess: 1,
    };
  }

  private updateAskAid(hive: Hive) {
    hive.shortages = {};

    // hive is lost, don't help it
    if (!this.hiveValidForAid(hive)) return;

    for (const [r, amount] of Object.entries(hive.resState)) {
      if (amount >= 0) continue;

      const res = r as ResourceConstant;
      // hives that can help with resource
      let validHives = _.filter(
        this.nodes,
        (h) =>
          h.roomName !== hive.roomName &&
          h.state === hiveStates.economy &&
          this.calcAmount(h.roomName, hive.roomName, res) > 0
      ).map((h) => h.roomName);

      // don't send energy if too expensive
      const sendCost = (h: string) =>
        Game.market.calcTransactionCost(100000, hive.roomName, h) / 100000;
      if (res === RESOURCE_ENERGY)
        validHives = validHives.filter((h) => sendCost(h) < 0.31); // 11 or less roomDist

      if (!validHives.length) {
        // can't help from some hive
        // need to buyIn
        hive.shortages[res] = -hive.getResState(res);
        continue;
      }

      // no need to buy in can help from some hive
      const validHive = validHives.reduce((prev, curr) =>
        hive.pos.getRoomRangeTo(curr, "lin") <
        hive.pos.getRoomRangeTo(prev, "lin")
          ? curr
          : prev
      );
      const amountAid = this.calcAmount(validHive, hive.roomName, res);
      if (this.aid[validHive] && this.aid[validHive].amount > amountAid)
        continue;
      this.aid[validHive] = {
        to: hive.roomName,
        res,
        amount: amountAid,
      };
    }
    this.storeExtraRes(hive);
  }

  private updatePlanAid() {
    for (const [hiveName, aid] of Object.entries(this.aid)) {
      const hiveFrom = Apiary.hives[hiveName];
      const sCell = hiveFrom.cells.storage;
      if (!aid.excess) aid.amount = this.calcAmount(hiveName, aid.to, aid.res);
      if (
        !this.hiveValidForAid(Apiary.hives[aid.to]) ||
        aid.amount <= 0 ||
        hiveFrom.state !== hiveStates.economy
      ) {
        delete this.aid[hiveName];
        continue;
      }
      addResDict(sCell.resTargetTerminal, aid.res, aid.amount);
    }
  }

  private updateStateHive(hive: Hive) {
    hive.resState = { energy: 0 };
    const sCell = hive.cells.storage;
    if (!sCell) return;

    this.updateTerminalResState(hive);
    sCell.updateUsedCapacity();

    for (const [res, amount] of Object.entries(sCell.usedCapacity))
      addResDict(hive.resState, res, amount);

    for (const [res, amount] of Object.entries(hive.resTarget))
      addResDict(hive.resState, res, -amount);

    for (const [res, amount] of Object.entries(hive.mastersResTarget))
      addResDict(hive.resState, res, -amount);

    if (!sCell.terminal) return;

    for (const [res, amount] of Object.entries(hive.resState))
      addResDict(this.resState, res, amount);
  }

  private updateTerminalResState(hive: Hive) {
    const sCell = hive.cells.storage;
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
  }

  // #endregion Private Methods (9)
}
