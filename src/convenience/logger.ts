// import { setupsNames } from "../enums";
import { HiveLog } from "abstract/hiveMemory";
import { setups } from "bees/creepSetups";
import type { ProtoOrder } from "bugSmuggling/broker";
import type { Hive } from "hive/hive";
import type { FlagOrder } from "orders/order";
import { profile } from "profiler/decorator";
import { LOGGING_CYCLE } from "settings";
import { ZERO_COSTS_BUILDING_HIVE } from "static/constants";
import { prefix } from "static/enums";
import { makeId } from "static/utils";

const EVENT_ID_LENGTH = 6;

@profile
export class Logger {
  private smallProcesses = {
    update: { sum: 0, amount: 0 },
    run: { sum: 0, amount: 0 },
  };

  public constructor() {
    Memory.log.tick.create = Game.time;
  }

  public static init(force: boolean = false) {
    if (force || !Memory.log)
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
    if (force) Memory.reportEvents = { orders: {}, enemies: {}, crashes: {} };
  }

  public update() {
    Memory.log.cpuUsage = { update: {}, run: {} };
    this.smallProcesses = {
      update: { sum: 0, amount: 0 },
      run: { sum: 0, amount: 0 },
    };
  }

  public get notAccountedMemory() {
    return (
      _.reduce(Memory.log.cpuUsage.update, (mem, curr) => curr.cpu + mem, 0) +
      _.reduce(Memory.log.cpuUsage.run, (mem, curr) => curr.cpu + mem, 0) -
      Game.cpu.getUsed()
    );
  }

  private reportMarketEvent(
    eventId: string,
    resMarket: MarketResourceConstant,
    amount: number,
    comment: string,
    time: number = Game.time
  ) {
    const resource = resMarket as ResourceConstant;
    if (!Memory.log.market.resourceEvents[resource])
      Memory.log.market.resourceEvents[resource] = {};
    Memory.log.market.resourceEvents[resource]![eventId] = {
      tick: time,
      amount: Math.round(amount * 1000),
      comment,
    };
  }

  public reportMarketFeeChange(
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

  public reportMarketCreation(
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

  private reportMarket() {
    for (const transaction of Game.market.incomingTransactions) {
      if (Game.time - transaction.time > LOGGING_CYCLE) break;
      if (!transaction.order) continue;
      if (transaction.transactionId in Memory.log.market.resourceEvents)
        continue;
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
      if (transaction.transactionId in Memory.log.market.resourceEvents)
        continue;
      this.reportMarketEvent(
        transaction.transactionId,
        transaction.resourceType,
        transaction.amount * transaction.order.price,
        "sell_" + (transaction.order.type === ORDER_SELL ? "long" : "short"),
        transaction.time
      );
    }
  }

  public run() {
    const cpu = Game.cpu.getUsed();
    _.forEach(Apiary.hives, (hive) => {
      this.hiveLog(hive);
    });

    Memory.log.tick.current = Game.time;
    Memory.log.market.credits = Math.round(Game.market.credits * 1000);
    this.reportMarket();
    Memory.log.pixels = Game.resources.pixel as number;
    Memory.log.gcl = {
      level: Game.gcl.level,
      progress: Game.gcl.progress,
      progressTotal: Game.gcl.progressTotal,
    };
    Memory.log.gpl = {
      level: Game.gpl.level,
      progress: Game.gpl.progress,
      progressTotal: Game.gpl.progressTotal,
    };
    if (Memory.settings.reportCPU) {
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
    Memory.log.cpu = {
      limit: Game.cpu.limit,
      used: Game.cpu.getUsed(),
      bucket: Game.cpu.bucket,
    };
  }

  public reportCPU(
    ref: string,
    mode: "run" | "update",
    usedCPU: number,
    amount: number,
    reportSmall: boolean = false
  ) {
    if (usedCPU < 0.001 && !reportSmall) {
      this.smallProcesses[mode].sum += usedCPU;
      this.smallProcesses[mode].amount += 1;
      return;
    }
    usedCPU *= 1000;
    Memory.log.cpuUsage[mode][ref] = {
      cpu: usedCPU,
      norm: usedCPU / (amount || 1),
    };
  }

  public hiveLog(hive: Hive) {
    let mem = Memory.log.hives[hive.roomName];
    if (!mem) {
      Memory.log.hives[hive.roomName] = this.emptyHiveLog;
      mem = Memory.log.hives[hive.roomName];
    }
    mem.annexNames = hive.annexNames;
    mem.spawOrders = Object.keys(hive.spawOrders).length;
    mem.construction = {
      numStruct: hive.structuresConst.length,
      costs: hive.buildingCosts,
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

  private get newEventId() {
    return makeId(EVENT_ID_LENGTH);
  }

  public addResourceStat(
    hiveName: string,
    comment: string,
    amount: number,
    resource: ResourceConstant
  ) {
    if (!Memory.log.hives[hiveName]) return ERR_NOT_FOUND;
    if (!Memory.log.hives[hiveName].resourceEvents[resource])
      Memory.log.hives[hiveName].resourceEvents[resource] = {};
    let ref = this.newEventId;
    while (Memory.log.hives[hiveName].resourceEvents[resource]![ref])
      ref = this.newEventId;
    Memory.log.hives[hiveName].resourceEvents[resource]![ref] = {
      tick: Game.time,
      amount,
      comment,
    };
    return OK;
  }

  public resourceTransfer<R extends ResourceConstant>(
    hiveName: string,
    ref: string,
    storeFrom: Store<R, false>,
    storeTo: Store<R, false>,
    resource: R = RESOURCE_ENERGY as R,
    mode: 1 | -1 = -1,
    loss?: { ref: string; per: number }
  ) {
    if (!Memory.log.hives[hiveName]) return ERR_NOT_FOUND;
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

  public newSpawn(
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

  public marketShort(
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

  public marketLong(order: Order) {
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

  public newTerminalTransfer(
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

  private get emptyHiveLog(): HiveLog {
    return {
      annexNames: [],
      construction: {
        numStruct: 0,
        costs: _.cloneDeep(ZERO_COSTS_BUILDING_HIVE),
      },
      spawOrders: 0,

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

  public reportEnemy(creep: Creep) {
    if (!Memory.reportEvents.enemies) Memory.reportEvents.enemies = {};
    const stats = Apiary.intel.getStats(creep).max;
    if (
      stats.dism > 1250 ||
      stats.dmgRange > 200 ||
      stats.dmgClose > 750 ||
      stats.heal > 300
    )
      Memory.reportEvents.enemies[
        creep.pos.roomName + "_" + creep.owner.username
      ] = {
        time: Game.time,
        owner: creep.owner.username,
        ...stats,
      };
  }

  public reportOrder(order: FlagOrder) {
    if (!order.master) return;
    if (!Memory.reportEvents.orders) Memory.reportEvents.orders = {};
    if (
      order.master &&
      order.master.spawned &&
      !order.ref.includes(prefix.defSwarm)
    )
      Memory.reportEvents.orders[order.ref] = {
        time: Game.time,
        pos: order.pos,
      };
  }

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

  /**
   * Removes old resource events
   * Also keeps report of events / crashes small
   */
  public clean() {
    for (const hiveName in Memory.log.hives) {
      if (!Apiary.hives[hiveName]) {
        delete Memory.log.hives[hiveName];
        continue;
      }
      this.cleanResourceEvents(Memory.log.hives[hiveName].resourceEvents);
    }
    this.cleanResourceEvents(Memory.log.market.resourceEvents);

    if (
      Memory.reportEvents.orders &&
      Object.keys(Memory.reportEvents.orders).length > 50
    ) {
      const sortedKeys = Object.keys(Memory.reportEvents.orders).sort(
        (a, b) =>
          Memory.reportEvents.orders![b].time -
          Memory.reportEvents.orders![a].time
      );
      for (let i = sortedKeys.length - 20; i >= 0; --i)
        delete Memory.reportEvents.orders[sortedKeys[i]];
    }

    if (
      Memory.reportEvents.crashes &&
      Object.keys(Memory.reportEvents.crashes).length > 50
    ) {
      const sortedKeys = Object.keys(Memory.reportEvents.crashes).sort(
        (a, b) =>
          Memory.reportEvents.crashes![b].time -
          Memory.reportEvents.crashes![a].time
      );
      for (let i = sortedKeys.length - 20; i >= 0; --i)
        delete Memory.reportEvents.crashes[sortedKeys[i]];
    }

    if (
      Memory.reportEvents.enemies &&
      Object.keys(Memory.reportEvents.enemies).length > 50
    ) {
      const sortedKeys = Object.keys(Memory.reportEvents.enemies).sort(
        (a, b) =>
          Memory.reportEvents.enemies![b].time -
          Memory.reportEvents.enemies![a].time
      );
      for (let i = sortedKeys.length - 20; i >= 0; --i)
        delete Memory.reportEvents.enemies[sortedKeys[i]];
    }
  }
}
