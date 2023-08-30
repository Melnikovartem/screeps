import { ProtoOrder } from "bugSmuggling/broker";
import { FlagOrder } from "orders/order";
import { prefix } from "static/enums";

export class EmptyLogger {
  protected intentsThisTick = 0;
  public constructor() {
    Memory.log = undefined;
  }

  public static wipe() {
    Memory.log = undefined;
    Memory.report = { crashes: {}, enemies: {}, orders: {} };
  }

  public update() {
    this.intentsThisTick = 0;
  }
  public run() {}

  public reportCPU(
    ref: string,
    mode: "run" | "update",
    usedCPU: number,
    amount: number,
    reportSmall?: boolean
  ) {}

  public addResourceStat(
    hiveName: string,
    comment: string,
    amount: number,
    resource: ResourceConstant
  ) {}

  public resourceTransfer<R extends ResourceConstant>(
    hiveName: string,
    ref: string,
    storeFrom: Store<R, false>,
    storeTo: Store<R, false>,
    resource?: R,
    mode?: 1 | -1,
    loss?: { ref: string; per: number }
  ) {}

  public newSpawn(
    beeName: string,
    spawn: StructureSpawn,
    cost: number,
    masterName: string
  ) {}

  public reportMarketCreation(
    resource: MarketResourceConstant,
    fee: number,
    type: ORDER_BUY | ORDER_SELL
  ) {}

  public reportMarketFeeChange(
    orderId: string,
    resource: MarketResourceConstant,
    fee: number,
    type: ORDER_BUY | ORDER_SELL
  ) {}

  public marketShortRes(
    order: Order | ProtoOrder,
    amount: number,
    hiveName: string
  ) {}

  public marketLongRes(order: Order) {}

  public newTerminalTransfer(
    terminalFrom: StructureTerminal,
    terminalTo: StructureTerminal,
    amount: number,
    resource: ResourceConstant
  ) {}

  public get notAccountedMemory() {
    return Game.cpu.getUsed();
  }

  public reportEnemy(creep: Creep) {
    if (!Memory.report.enemies) Memory.report.enemies = {};
    const stats = Apiary.intel.getStats(creep).max;
    if (
      stats.dism > 1250 ||
      stats.dmgRange > 200 ||
      stats.dmgClose > 750 ||
      stats.heal > 300
    )
      Memory.report.enemies[creep.pos.roomName + "_" + creep.owner.username] = {
        time: Game.time,
        owner: creep.owner.username,
        ...stats,
      };
  }

  public reportOrder(order: FlagOrder) {
    if (!order.master) return;
    if (!Memory.report.orders) Memory.report.orders = {};
    if (
      order.master &&
      order.master.spawned &&
      !order.ref.includes(prefix.defSwarm)
    )
      Memory.report.orders[order.ref] = {
        time: Game.time,
        pos: order.pos,
      };
  }

  public clean() {
    if (Memory.report.orders && Object.keys(Memory.report.orders).length > 50) {
      const sortedKeys = Object.keys(Memory.report.orders).sort(
        (a, b) => Memory.report.orders![b].time - Memory.report.orders![a].time
      );
      for (let i = sortedKeys.length - 20; i >= 0; --i)
        delete Memory.report.orders[sortedKeys[i]];
    }

    if (
      Memory.report.crashes &&
      Object.keys(Memory.report.crashes).length > 50
    ) {
      const sortedKeys = Object.keys(Memory.report.crashes).sort(
        (a, b) =>
          Memory.report.crashes![b].time - Memory.report.crashes![a].time
      );
      for (let i = sortedKeys.length - 20; i >= 0; --i)
        delete Memory.report.crashes[sortedKeys[i]];
    }

    if (
      Memory.report.enemies &&
      Object.keys(Memory.report.enemies).length > 50
    ) {
      const sortedKeys = Object.keys(Memory.report.enemies).sort(
        (a, b) =>
          Memory.report.enemies![b].time - Memory.report.enemies![a].time
      );
      for (let i = sortedKeys.length - 20; i >= 0; --i)
        delete Memory.report.enemies[sortedKeys[i]];
    }
  }
}
