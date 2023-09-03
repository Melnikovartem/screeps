import type { HiveLog } from "abstract/hiveMemory";
import { setups } from "bees/creepSetups";
import type { ProtoOrder } from "bugSmuggling/broker";
import type { Hive } from "hive/hive";
import { profile } from "profiler/decorator";
import { LOGGING_CYCLE } from "settings";
import { ZERO_COSTS_BUILDING_HIVE } from "static/constants";
import { makeId } from "static/utils";

import { EmptyLogger } from "./logger-empty";

const EVENT_ID_LENGTH = 6;

@profile
export class Logger extends EmptyLogger {
  // #region Properties (2)

  private shouldReportCpu = false;
  private smallProcesses = {
    update: { sum: 0, amount: 0 },
    run: { sum: 0, amount: 0 },
  };

  // #endregion Properties (2)

  // #region Constructors (1)

  public constructor() {
    super();
    this.emptyLog();
    this.log.tick.create = Game.time;
  }

  // #endregion Constructors (1)

  // #region Public Accessors (1)

  public override get notAccountedMemory() {
    return (
      _.reduce(this.log.cpuUsage.update, (mem, curr) => curr.cpu + mem, 0) +
      _.reduce(this.log.cpuUsage.run, (mem, curr) => curr.cpu + mem, 0) -
      Game.cpu.getUsed()
    );
  }

  // #endregion Public Accessors (1)

  // #region Private Accessors (3)

  private get emptyHiveLog(): HiveLog {
    return {
      annexNames: [],
      construction: {
        numStruct: 0,
        costs: _.cloneDeep(ZERO_COSTS_BUILDING_HIVE),
      },
      spawnQueLen: 0,

      energy: {
        storage: 0,
        terminal: 0,
        spawners: 0,
      },
      controller: { level: 0, progress: 0, progressTotal: 0 },

      nukes: {},
      defenseHealth: { max: 0, min: 0, avg: 0 },
      resourceEvents: {},
    };
  }

  /** while this class is active this.log is real */
  private get log() {
    return Memory.log!;
  }

  private get newEventId() {
    return makeId(EVENT_ID_LENGTH);
  }

  // #endregion Private Accessors (3)

  // #region Public Methods (12)

  public override addResourceStat(
    hiveName: string,
    comment: string,
    amount: number,
    resource: ResourceConstant
  ) {
    if (!this.log.hives[hiveName]) return ERR_NOT_FOUND;
    if (!this.log.hives[hiveName].resourceEvents[resource])
      this.log.hives[hiveName].resourceEvents[resource] = {};
    let ref = this.newEventId;
    while (this.log.hives[hiveName].resourceEvents[resource]![ref])
      ref = this.newEventId;
    this.log.hives[hiveName].resourceEvents[resource]![ref] = {
      tick: Game.time,
      amount,
      comment,
    };
    return OK;
  }

  /**
   * Removes old resource events
   * Also keeps report of events / crashes small
   */
  public override clean() {
    super.clean();
    for (const hiveName in this.log.hives) {
      if (!Apiary.hives[hiveName]) {
        delete this.log.hives[hiveName];
        continue;
      }
      this.cleanResourceEvents(this.log.hives[hiveName].resourceEvents);
    }
    this.cleanResourceEvents(this.log.market.resourceEvents);
  }

  public override marketLongRes(order: Order) {
    const res = order.resourceType as ResourceConstant;
    if (!RESOURCES_ALL.includes(res) || !order.roomName) return;
    let amount = order.totalAmount
      ? order.totalAmount - order.remainingAmount
      : 0;
    let type = "import";
    if (order.type === ORDER_SELL) {
      amount *= -1;
      type = "export";
    }
    this.addResourceStat(order.roomName, type, amount, res);
  }

  public override marketShortRes(
    order: Order | ProtoOrder,
    amount: number,
    hiveName: string
  ) {
    const res = order.resourceType as ResourceConstant;
    if (!RESOURCES_ALL.includes(res) || !order.roomName) return;
    this.addResourceStat(
      hiveName,
      "terminal",
      -Game.market.calcTransactionCost(amount, hiveName, order.roomName),
      RESOURCE_ENERGY
    );

    let type = "import";
    if (order.type === ORDER_BUY) {
      amount *= -1;
      type = "export";
    }
    this.addResourceStat(hiveName, type, amount, res);
  }

  public override newSpawn(
    beeName: string,
    spawn: StructureSpawn,
    cost: number,
    masterName: string
  ) {
    let name = beeName.substring(0, beeName.length - 5);
    if (name === setups.miner.energy.name)
      name += " " + masterName.slice(masterName.length - 4);
    this.addResourceStat(
      spawn.pos.roomName,
      "spawn_" + name,
      -cost,
      RESOURCE_ENERGY
    );
    return OK;
  }

  public override newTerminalTransfer(
    terminalFrom: StructureTerminal,
    terminalTo: StructureTerminal,
    amount: number,
    resource: ResourceConstant
  ) {
    this.addResourceStat(
      terminalFrom.pos.roomName,
      "export local",
      -amount,
      resource
    );
    this.addResourceStat(
      terminalTo.pos.roomName,
      "import local",
      amount,
      resource
    );
    this.addResourceStat(
      terminalFrom.pos.roomName,
      "terminal",
      -Game.market.calcTransactionCost(
        amount,
        terminalFrom.pos.roomName,
        terminalTo.pos.roomName
      ),
      RESOURCE_ENERGY
    );
  }

  public override reportCPU(
    ref: string,
    mode: "run" | "update",
    usedCPU: number,
    amount: number,
    reportSmall: boolean = false
  ) {
    if (!this.shouldReportCpu) return;
    if (usedCPU < 0.001 && !reportSmall) {
      this.smallProcesses[mode].sum += usedCPU;
      this.smallProcesses[mode].amount += 1;
      return;
    }
    usedCPU *= 1000;
    this.log.cpuUsage[mode][ref] = {
      cpu: usedCPU,
      norm: usedCPU / (amount || 1),
    };
  }

  public override reportMarketCreation(
    resource: MarketResourceConstant,
    fee: number,
    type: ORDER_BUY | ORDER_SELL
  ) {
    this.reportMarketEvent(
      "CR" + makeId(8),
      resource,
      fee,
      type + "_feeCreation"
    );
  }

  public override reportMarketFeeChange(
    orderId: string,
    resource: MarketResourceConstant,
    fee: number,
    type: ORDER_BUY | ORDER_SELL
  ) {
    this.reportMarketEvent(
      orderId.slice(0, 2) + "CH" + makeId(6),
      resource,
      fee,
      type + "_feeChange"
    );
  }

  public override resourceTransfer<R extends ResourceConstant>(
    hiveName: string,
    ref: string,
    storeFrom: Store<R, false>,
    storeTo: Store<R, false>,
    resource: R = RESOURCE_ENERGY as R,
    mode: 1 | -1 = -1,
    loss?: { ref: string; per: number }
  ) {
    if (!this.log.hives[hiveName]) return ERR_NOT_FOUND;
    const amount = Math.floor(
      Math.min(
        +storeFrom.getUsedCapacity(resource)!,
        +storeTo.getFreeCapacity(resource)!
      ) * mode
    ); // * (1 - loss)
    this.addResourceStat(hiveName, ref, amount, resource);
    if (loss)
      this.addResourceStat(hiveName, loss.ref, -amount * loss.per, resource);
    return OK;
  }

  public override run() {
    const cpu = Game.cpu.getUsed();

    _.forEach(Apiary.hives, (hive) => {
      this.hiveLog(hive);
    });

    this.log.tick.current = Game.time;
    this.log.market.credits = Math.round(Game.market.credits * 1000);
    this.reportMarket();
    this.log.pixels = Game.resources.pixel as number;
    this.log.gcl = {
      level: Game.gcl.level,
      progress: Game.gcl.progress,
      progressTotal: Game.gcl.progressTotal,
    };
    this.log.gpl = {
      level: Game.gpl.level,
      progress: Game.gpl.progress,
      progressTotal: Game.gpl.progressTotal,
    };
    if (this.shouldReportCpu) {
      this.reportCPU(
        "log",
        "run",
        Game.cpu.getUsed() - cpu,
        Object.keys(Apiary.hives).length
      );
      this.reportCPU(
        "small_proc",
        "update",
        this.smallProcesses.run.sum,
        this.smallProcesses.run.amount,
        true
      );
      this.reportCPU(
        "small_proc",
        "run",
        this.smallProcesses.run.sum,
        this.smallProcesses.run.amount,
        true
      );
    }
    this.log.cpu = {
      limit: Game.cpu.limit,
      used: Game.cpu.getUsed(),
      bucket: Game.cpu.bucket,
    };
  }

  public override update() {
    super.update();
    this.shouldReportCpu = Memory.settings.reportCPU;
    this.log.cpuUsage = { update: {}, run: {} };
    this.smallProcesses = {
      update: { sum: 0, amount: 0 },
      run: { sum: 0, amount: 0 },
    };
  }

  // #endregion Public Methods (12)

  // #region Private Methods (5)

  private cleanResourceEvents(resourceEvents: resourceEventLog) {
    for (const r in resourceEvents) {
      const res = r as ResourceConstant;
      for (const eventId in resourceEvents[res]) {
        if (Game.time - resourceEvents[res]![eventId].tick > LOGGING_CYCLE)
          delete resourceEvents[res]![eventId];
      }
      if (Object.keys(resourceEvents[res]!).length === 0)
        delete resourceEvents[res];
    }
  }

  private emptyLog() {
    Memory.log = {
      tick: { current: Game.time, reset: Game.time, create: Game.time },
      gcl: {
        level: Game.gcl.level,
        progress: Game.gcl.progress,
        progressTotal: Game.gcl.progressTotal,
      },
      gpl: {
        level: Game.gpl.level,
        progress: Game.gpl.progress,
        progressTotal: Game.gpl.progressTotal,
      },
      market: {
        credits: Math.round(Game.market.credits * 1000),
        resourceEvents: {},
      },
      cpu: { limit: Game.cpu.limit, used: 0, bucket: Game.cpu.bucket },
      pixels: Game.resources.pixel as number,
      cpuUsage: { run: {}, update: {} },
      hives: {},
    };
  }

  private hiveLog(hive: Hive) {
    let mem = this.log.hives[hive.roomName];
    if (!mem) {
      this.log.hives[hive.roomName] = this.emptyHiveLog;
      mem = this.log.hives[hive.roomName];
    }
    mem.annexNames = hive.annexNames;
    mem.spawnQueLen = hive.cells.spawn.spawnQue.length;
    mem.construction = {
      numStruct: hive.cells.build.structuresConst.length,
      costs: hive.cells.build.buildingCosts,
    };
    mem.energy = {
      storage: hive.room.storage ? hive.room.storage.store.energy : 0,
      terminal: hive.room.terminal ? hive.room.terminal.store.energy : 0,
      spawners: hive.room.energyAvailable,
    };
    mem.controller = {
      level: hive.controller.level,
      progress: hive.controller.progress,
      progressTotal: hive.controller.progressTotal,
    };

    if (Game.time % 5 === 0) {
      mem.defenseHealth = { max: 0, min: 0, avg: 0 };
      const plan = Memory.cache.roomPlanner[hive.roomName];
      if (plan) {
        let sumHits = 0;
        let nStruct = 1;
        let maxHits = -1;
        let minHits = -1;

        _.forEach([STRUCTURE_WALL, STRUCTURE_RAMPART], (defense) => {
          _.forEach((plan[defense] || { pos: [] }).pos, (p) => {
            const pos = new RoomPosition(p.x, p.y, hive.roomName);
            const ss = pos
              .lookFor(LOOK_STRUCTURES)
              .filter((s) => s.structureType === defense)[0];
            const hits = (ss && ss.hits) || 0;
            sumHits += hits;
            nStruct += 1;
            if (hits > maxHits) maxHits = hits;
            if (hits < minHits || minHits === -1) minHits = hits;
          });
        });
        mem.defenseHealth = {
          max: maxHits,
          min: minHits,
          avg: sumHits / nStruct,
        };
      }
      mem.nukes = {};
      _.forEach(hive.cells.defense.nukes, (nuke) => {
        mem.nukes[nuke.id] = { [nuke.launchRoomName]: nuke.timeToLand };
      });
    }
  }

  private reportMarket() {
    for (const transaction of Game.market.incomingTransactions) {
      if (Game.time - transaction.time > LOGGING_CYCLE) break;
      if (!transaction.order) continue;
      if (transaction.transactionId in this.log.market.resourceEvents) continue;
      this.reportMarketEvent(
        transaction.transactionId,
        transaction.resourceType,
        transaction.amount * transaction.order.price,
        "buy_" + (transaction.order.type === ORDER_BUY ? "long" : "short"),
        transaction.time
      );
    }
    for (const transaction of Game.market.outgoingTransactions) {
      if (Game.time - transaction.time > LOGGING_CYCLE) break;
      if (!transaction.order) continue;
      if (transaction.transactionId in this.log.market.resourceEvents) continue;
      this.reportMarketEvent(
        transaction.transactionId,
        transaction.resourceType,
        transaction.amount * transaction.order.price,
        "sell_" + (transaction.order.type === ORDER_SELL ? "long" : "short"),
        transaction.time
      );
    }
  }

  private reportMarketEvent(
    eventId: string,
    resMarket: MarketResourceConstant,
    amount: number,
    comment: string,
    time: number = Game.time
  ) {
    const resource = resMarket as ResourceConstant;
    if (!this.log.market.resourceEvents[resource])
      this.log.market.resourceEvents[resource] = {};
    this.log.market.resourceEvents[resource]![eventId] = {
      tick: time,
      amount: Math.round(amount * 1000),
      comment,
    };
  }

  // #endregion Private Methods (5)
}
