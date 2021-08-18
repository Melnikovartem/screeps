import { makeId } from "./utils";

export class CustomConsole {

  // some hand used functions
  terminal(roomName: string, resource?: ResourceConstant, mode?: "fill" | "empty", amount?: number): string {
    let cell = Apiary.hives[roomName] && Apiary.hives[roomName].cells.storage;
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
      return `OK ${order.type == ORDER_SELL ? "BOUGHT" : "SOLD"}\nRESOURCE ${order.resourceType
        }: ${amount}\nMONEY: ${amount * order.price}\nENERGY: ${energy}`;
    else if (ans == ERR_NOT_ENOUGH_RESOURCES)
      return `NOT ENOUGHT RESOURSES TO ${order.type == ORDER_SELL ? "BUY" : "SELL"
        }\nRESOURCE ${order.resourceType}: ${amount}\nMONEY: ${amount * order.price}\nENERGY: ${energy}`;
    return ans;
  }

  printHives() {
    return _.map(Apiary.hives, (o) => o.print).join('\n');
  }

  printMasters(hiveName?: string) {
    return _.map(_.filter(Apiary.masters, (m) => !hiveName || m.hive.roomName == hiveName), (o) => o.print).join('\n');
  }

  printOrders(hiveName?: string) {
    return _.map(_.filter(Apiary.orders, (o) => !hiveName || o.hive.roomName == hiveName), (o) => o.print).join('\n');
  }

  printBees(masterName?: string) {
    return _.map(_.filter(Apiary.bees, (b) => !masterName || b.creep.memory.refMaster == masterName), (b) => b.print).join('\n');
  }

  printspawOrders(hiveName?: string) {
    return _.map(_.filter(Apiary.hives, (h) => !hiveName || h.roomName == hiveName), (h) => `${h.print
      }:\n${_.map(h.spawOrders, (o, master) => `${o.priority} ${master}: ${o.setup.name} ${o.amount}`).join('\n')}\n`).join('\n');
  }
}
