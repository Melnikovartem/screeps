import { Bee } from "./bee";
import { Master } from "./beeMaster/_Master";
import { Hive } from "./Hive";
import { Order } from "./order";
import { Intel } from "./intelligence";

import { makeId, safeWrap } from "./utils";
import { profile } from "./profiler/decorator";
import { PRINT_INFO } from "./settings";

@profile
export class _Apiary {
  destroyTime: number;
  intel: Intel;

  bees: { [id: string]: Bee } = {};
  hives: { [id: string]: Hive } = {};
  masters: { [id: string]: Master } = {};
  orders: { [id: string]: Order } = {};

  constructor() {
    if (PRINT_INFO) console.log(Game.time, "creating new apiary");

    this.destroyTime = Game.time + 4000;
    this.intel = new Intel();
  }

  init() {
    _.forEach(Game.rooms, (room) => {
      if (room.controller && room.controller.my)
        this.hives[room.name] = new Hive(room.name);
    });
  }

  findBees() {
    // after all the masters where created and retrived if it was needed
    for (const name in Memory.creeps) {
      if (!this.bees[name]) {
        let creep = Game.creeps[name];
        if (this.masters[creep.memory.refMaster]) {
          // not sure if i rly need a global bees hash
          this.bees[creep.name] = new Bee(creep);
          this.masters[creep.memory.refMaster].newBee(this.bees[creep.name]);
        } else if (creep.memory.refMaster.includes("masterDevelopmentCell_")) {
          // TODO think of something smart
          let randomMaster = Object.keys(this.masters)[Math.floor(Math.random() * Object.keys(this.masters).length)];
          creep.memory.refMaster = randomMaster;
          this.bees[creep.name] = new Bee(creep);
          this.masters[creep.memory.refMaster].newBee(this.bees[creep.name]);
        }
        // idk what to do if i lost a master to the bee. I guess the bee is just FUCKED for now
      }
    }
  }

  updateOrder(flag: Flag) {
    let ref = flag.name;
    if (!this.orders[ref])
      this.orders[ref] = new Order(flag);
    else
      safeWrap(() => this.orders[ref].update(flag), this.orders[ref].print + " update");
  }

  // update phase
  update() {
    _.forEach(Game.flags, (flag) => {
      this.updateOrder(flag);
    });

    _.forEach(this.hives, (hive) => {
      safeWrap(() => hive.update(), hive.print + " update");
    });

    _.forEach(this.bees, (bee) => {
      bee.update();
    });
    this.findBees();

    _.forEach(this.masters, (master) => {
      safeWrap(() => master.update(), master.print + " update");
    });
  }

  // run phase
  run() {
    _.forEach(this.hives, (hive) => {
      safeWrap(() => hive.run(), hive.print + " run");
    });
    _.forEach(this.masters, (master) => {
      safeWrap(() => master.run(), master.print + " run");
    });
  }

  // some hand used functions
  terminal(roomName: string, resource?: ResourceConstant, mode?: "fill" | "empty", amount?: number): string {
    let cell = this.hives[roomName] && this.hives[roomName].cells.storage;
    if (!cell || !cell.terminal)
      return "ERROR: TERMINAL NOT FOUND";
    if (mode && mode != "fill" && mode != "empty")
      return "BAD ARGUMENTS";

    resource = resource ? resource : RESOURCE_ENERGY;
    amount = amount ? amount : 0;

    if (!mode) {
      if (cell.storage.store[resource] > amount)
        mode = "fill";
      if (cell.terminal.store[resource] > amount) {
        if (mode == "fill") {
          if (resource != RESOURCE_ENERGY)
            return "CAN'T DESIDE ON MODE";
        } else
          mode = "empty";
      }
    }

    if (!mode)
      return "NO VALID MODE FOUND";

    let from;
    let to;
    if (mode == "empty") {
      from = cell.terminal;
      to = cell.storage;
    } else {
      to = cell.terminal;
      from = cell.storage;
    }

    if (mode == "fill" && resource == RESOURCE_ENERGY && !amount)
      amount = Math.min(amount, 10000);
    amount = Math.min(amount ? amount : 10000, from.store[resource]);
    let ref = "!USER_REQUEST " + makeId(4);
    cell.requests[ref] = ({
      ref: ref,
      from: [from],
      to: [to],
      resource: resource,
      amount: amount,
      priority: 2,
    });
    return `OK ${mode.toUpperCase()} TERMINAL\nRESOURCE ${resource}: ${amount}`;
  }

  completeOrder(orderId: string, am?: number) {
    let order = Game.market.getOrderById(orderId);
    if (!order)
      return "ORDER NOT FOUND";
    if (order.type == ORDER_SELL && !am)
      return `AMOUNT NEEDED. MAX: ${Math.min(order.amount, Math.floor(Game.market.credits / order.price))}`;

    let amount = am ? am : order.remainingAmount;
    let ans;
    let energy: number | string = "NOT NEEDED";
    if (!order.roomName) {
      ans = Game.market.deal(orderId, amount);
    } else {
      let resource = <ResourceConstant>order.resourceType;
      let validHives = _.filter(Apiary.hives, (h) => h.cells.storage && h.cells.storage.terminal
        && ((order!.type == ORDER_BUY && h.cells.storage.terminal.store[resource] > amount)
          || (order!.type == ORDER_SELL && h.cells.storage.terminal.store.getFreeCapacity(resource) > amount)));

      validHives.sort((a, b) => Game.market.calcTransactionCost(amount, a.roomName, order!.roomName!) -
        Game.market.calcTransactionCost(amount, b.roomName, order!.roomName!));

      let terminal = validHives[0].cells.storage!.terminal!;

      if (order.type == ORDER_BUY)
        amount = Math.min(amount, terminal.store[resource]);
      else
        amount = Math.min(amount, terminal.store.getFreeCapacity(resource));

      energy = Game.market.calcTransactionCost(amount, terminal.pos.roomName, order.roomName);
      ans = Game.market.deal(orderId, amount, terminal.pos.roomName);
    }

    if (ans == OK)
      return `OK ${order.type == ORDER_SELL ? "BOUGHT" : "SOLD"}\nRESOURCE ${order.resourceType}: ${amount}\n
      MONEY: ${amount * order.price}\nENERGY: ${energy}`;
    else if (ans == ERR_NOT_ENOUGH_RESOURCES)
      return `NOT ENOUGHT RESOURSES TO ${order.type == ORDER_SELL ? "BUY" : "SELL"}\n
      RESOURCE ${order.resourceType}: ${amount}\nMONEY: ${amount * order.price}\nENERGY: ${energy}`;
    return ans;
  }

  printHives() {
    console.log(_.map(this.hives, (o) => o.print).join('\n'));
  }

  printMasters(hiveName?: string) {
    console.log(_.map(_.filter(this.masters, (m) => !hiveName || m.hive.roomName == hiveName), (o) => o.print).join('\n'));
  }

  printOrders(hiveName?: string) {
    return _.map(_.filter(this.orders, (o) => !hiveName || o.hive.roomName == hiveName), (o) => o.print).join('\n');
  }

  printBees(masterName?: string) {
    console.log(_.map(_.filter(this.bees, (b) => !masterName || b.creep.memory.refMaster == masterName), (b) => b.print).join('\n'));
  }
}
