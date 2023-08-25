import { BASE_MINERALS } from "../cells/stage1/laboratoryCell";
import { TERMINAL_ENERGY } from "../cells/stage1/storageCell";
import { hiveStates } from "../enums";
//  import { COMPRESS_MAP } from "../cells/stage1/factoryCell"; COMMODITIES_TO_SELL
import type { Hive, ResTarget } from "../Hive";
import { profile } from "../profiler/decorator";
import { addResDict } from "./utils";

const PADDING_RESOURCE = MAX_CREEP_SIZE * LAB_BOOST_MINERAL;
export const FREE_CAPACITY = STORAGE_CAPACITY * 0.1;
export const FULL_CAPACITY = STORAGE_CAPACITY * 0.01;
const SELL_STEP = 8192;

@profile
export class Network {
  public nodes: Hive[] = [];
  public aid: {
    [hiveNameFrom: string]: {
      to: string;
      res: ResourceConstant;
      amount: number;
      excess?: number;
    };
  } = {}; // from -> to
  public resState: ResTarget = {};

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

  private canHiveBuy(hive: Hive, res: ResourceConstant) {
    let canBuyIn = false;
    switch (hive.shouldDo("buyIn")) {
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

  public run() {
    // to be able to save some cpu on buyIns

    for (const hive of this.nodes) {
      if (!hive.cells.storage || !hive.cells.storage.terminal) continue;
      const terminal = hive.cells.storage.terminal;
      let usedTerminal = false;

      for (const r in hive.shortages) {
        const res = r as ResourceConstant;
        if (this.canHiveBuy(hive, res)) {
          const amount = hive.shortages[res]!;
          const ans = Apiary.broker.buyIn(
            terminal,
            res,
            amount + PADDING_RESOURCE,
            hive.cells.storage.getUsedCapacity(res) <= LAB_BOOST_MINERAL * 2
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
            const ans = terminal.send(aid.res, amount, aid.to);
            if (ans === OK) {
              if (Apiary.logger)
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
          hive.mastersResTarget[res]! - hive.cells.storage.getUsedCapacity(res);
        if (balanceShortage > 0 && this.canHiveBuy(hive, res)) {
          const ans = Apiary.broker.buyIn(terminal, res, balanceShortage, true);
          if (ans === "short") {
            usedTerminal = true;
            break;
          }
        }
      }
      if (usedTerminal) continue;

      const stStore = hive.cells.storage.storage.store;
      if (
        stStore.getFreeCapacity() < FREE_CAPACITY * 0.5 &&
        hive.cells.storage.storage instanceof StructureStorage
      ) {
        const keys = Object.keys(hive.resState) as (keyof ResTarget)[];
        if (!keys.length) continue;
        const res = keys.reduce((prev, curr) =>
          hive.resState[curr]! > hive.resState[prev]! ? curr : prev
        );
        if (hive.resState[res]! < 0) continue;
        if (hive.shouldDo("sellOff"))
          Apiary.broker.sellOff(
            terminal,
            res,
            Math.min(SELL_STEP, hive.resState[res]! * 0.8),
            stStore.getFreeCapacity() < FULL_CAPACITY * 2
          );
      }
    }
  }

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

    if (
      hive.cells.storage &&
      hive.cells.storage.storage.store.getFreeCapacity() < FREE_CAPACITY &&
      !this.aid[hive.roomName]
    ) {
      const emptyHive = _.filter(
        this.nodes,
        (h) =>
          h.roomName !== hive.roomName &&
          h.cells.storage &&
          h.cells.storage.storage.store.getFreeCapacity() >
            FREE_CAPACITY * 1.5 &&
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
}
