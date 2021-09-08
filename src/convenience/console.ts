export class CustomConsole {

  vis(framerate: number = 1) {
    if (Memory.settings.framerate)
      Memory.settings.framerate = 0;
    else
      Memory.settings.framerate = framerate;
  }

  // some hand used functions
  terminal(roomName: string, resource: ResourceConstant = RESOURCE_ENERGY, amount: number = Infinity, mode?: "fill" | "empty") {
    let hive = Apiary.hives[roomName];
    let cell = hive && hive.cells.storage;
    if (!cell || !cell.terminal)
      return `ERROR: TERMINAL NOT FOUND @ ${hive.print}`;

    if (!mode) {
      if (cell.storage.store.getUsedCapacity(resource) >= (amount === Infinity ? 1 : amount))
        mode = "fill";
      if (cell.terminal.store.getUsedCapacity(resource) >= (amount === Infinity ? 1 : amount)) {
        if (mode === "fill") {
          if (resource !== RESOURCE_ENERGY)
            return `CAN'T DESIDE ON MODE @ ${hive.print}`;
        } else
          mode = "empty";
      }
    }

    if (!mode || (mode !== "fill" && mode !== "empty"))
      return `NO VALID MODE FOUND @ ${hive.print}`;

    if (mode === "fill" && resource === RESOURCE_ENERGY && amount === Infinity)
      amount = Math.min(cell.terminal.store.getFreeCapacity(resource), 100000);

    let ans;
    if (mode === "empty")
      ans = cell.requestToStorage("!USER_REQUEST", cell.terminal, 2, resource, Math.min(amount, cell.terminal.store.getUsedCapacity(resource)));
    else
      ans = cell.requestFromStorage("!USER_REQUEST", cell.terminal, 2, resource, Math.min(amount, cell.terminal.store.getFreeCapacity(resource)));

    return `${mode.toUpperCase()} TERMINAL @ ${hive.print} \nRESOURCE ${resource}: ${ans} `;
  }

  terminalSend(roomNameFrom: string, roomNameTo: string, resource: ResourceConstant = RESOURCE_ENERGY, amount: number = Infinity) {
    let hiveFrom = Apiary.hives[roomNameFrom];
    let terminalFrom = hiveFrom && hiveFrom.cells.storage && hiveFrom.cells.storage!.terminal;
    if (!terminalFrom)
      return `ERROR: FROM TERMINAL NOT FOUND @ ${hiveFrom.print}`;
    if (terminalFrom.cooldown > 0)
      return "TERMINAL COOLDOWN";
    let hiveTo = Apiary.hives[roomNameTo];
    let terminalTo = hiveTo && hiveTo.cells.storage && hiveTo.cells.storage!.terminal;
    if (!terminalTo)
      return `ERROR: TO TERMINAL NOT @ ${roomNameTo}`;

    amount = Math.min(amount, terminalFrom.store.getUsedCapacity(resource));
    amount = Math.min(amount, terminalTo.store.getFreeCapacity(resource));

    let energyCost = Game.market.calcTransactionCost(10000, roomNameFrom, roomNameTo) / 10000;
    let energyCap = Math.floor(terminalFrom.store.getUsedCapacity(RESOURCE_ENERGY) / energyCost);
    amount = Math.min(amount, energyCap);

    if (resource === RESOURCE_ENERGY && amount * (1 + energyCost) > terminalFrom.store.getUsedCapacity(RESOURCE_ENERGY))
      amount = Math.floor(amount * (1 - energyCost));

    let ans = terminalFrom.send(resource, amount, roomNameTo);
    let info = ` SEND FROM ${hiveFrom.print} TO ${hiveTo.print} \nRESOURCE ${resource}: ${amount
      } \nENERGY: ${Game.market.calcTransactionCost(amount, roomNameFrom, roomNameTo)}`;
    if (ans === OK)
      return "OK" + info;
    else
      return `ERROR ${ans}` + info;
  }

  transfer(roomNameFrom: string, roomNameTo: string, res: ResourceConstant = RESOURCE_ENERGY, amount?: number) {
    console.log(this.terminal(roomNameFrom, res, amount, "fill"));
    console.log(this.terminal(roomNameTo, res, amount, "empty"));
    console.log(this.terminalSend(roomNameFrom, roomNameTo, res, amount));
  }

  completeOrder(orderId: string, roomName?: string, am: number = Infinity) {
    let order = Game.market.getOrderById(orderId);
    if (!order)
      return "ORDER NOT FOUND";
    if (order.type === ORDER_SELL && !am)
      return `AMOUNT NEEDED.MAX: ${Math.min(order.amount, Math.floor(Game.market.credits / order.price))} `;

    let amount = Math.min(am, order.remainingAmount);
    let ans;
    let energy: number | string = "NOT NEEDED";
    let hiveName: string = "global";
    if (!order.roomName) {
      ans = Game.market.deal(orderId, amount);
    } else {
      let resource = <ResourceConstant>order.resourceType;
      let hive;
      let validateTerminal = (t: StructureTerminal) =>
        (order!.type === ORDER_BUY && t.store.getUsedCapacity(resource) > amount)
        || (order!.type === ORDER_SELL && t.store.getFreeCapacity(resource) > amount);
      if (roomName)
        hive = Apiary.hives[roomName];
      else {
        let validHives = _.filter(Apiary.hives, (h) => h.cells.storage && h.cells.storage.terminal && validateTerminal(h.cells.storage.terminal));
        validHives.sort((a, b) => Game.market.calcTransactionCost(amount, a.roomName, order!.roomName!) -
          Game.market.calcTransactionCost(amount, b.roomName, order!.roomName!));
        hive = validHives.pop();
      }

      if (!hive)
        return `NO VALID HIVE FOUND`;
      hiveName = hive.print;
      let terminal = hive.cells.storage!.terminal!;
      if (!terminal || !validateTerminal(terminal))
        return `NO VALID TERMINAL NOT FOUND @ ${hive.print}`;
      if (terminal.cooldown)
        return `TERMINAL COOLDOWN`

      if (order.type === ORDER_BUY)
        amount = Math.min(amount, terminal.store.getUsedCapacity(resource));
      else
        amount = Math.min(amount, terminal.store.getFreeCapacity(resource));

      energy = Game.market.calcTransactionCost(amount, terminal.pos.roomName, order.roomName);
      ans = Game.market.deal(orderId, amount, terminal.pos.roomName);
      if (ans === OK && Apiary.logger)
        Apiary.logger.newMarketOperation(order, amount, terminal.pos.roomName);
    }

    let info = ` ${order.type === ORDER_SELL ? "BOUGHT" : "SOLD"} @ ${hiveName} \nRESOURCE ${order.resourceType.toUpperCase()
      }: ${amount} \nMONEY: ${amount * order.price} \nENERGY: ${energy}`;
    if (ans === OK)
      return "OK" + info;
    else
      return `ERROR ${ans}` + info;
  }

  buy(roomName: string, resource: ResourceConstant, sets: number = 1, amount: number = 1500 * sets) {
    let targetPrice = -1;
    let sum = 0, count = 0;
    let anchor = new RoomPosition(25, 25, roomName);
    let orders = Game.market.getAllOrders((order) => {
      if (order.type == ORDER_BUY || order.resourceType !== resource || !order.roomName)
        return false;
      if (targetPrice < order.price)
        targetPrice = order.price;
      sum += order.price;
      ++count;
      return anchor.getRoomRangeTo(order.roomName!) < 50;
    });
    targetPrice = Math.min(targetPrice, (sum / count) * 1.2);
    console.log(orders.length, targetPrice);
    if (orders.length)
      orders = orders.filter((order) => order.price < targetPrice * 0.9);
    if (orders.length) {
      orders.sort((a, b) => a.price - b.price);
      return this.completeOrder(orders[0].id, roomName, amount);
    }
    return `NO GOOD DEAL FOR ${resource.toUpperCase()} : ${amount} @ ${roomName} `;
  }

  printHives() {
    _.forEach(_.map(Apiary.hives, (o) => o.print), (s) => console.log(s));
  }

  printMasters(hiveName?: string) {
    _.forEach(_.map(_.filter(Apiary.masters, (m) => !hiveName || m.hive.roomName === hiveName), (o) => o.print), (s) => console.log(s));
  }

  printOrders(hiveName?: string, masters: boolean = true) {
    _.forEach(_.map(_.filter(Apiary.orders, (o) => (!hiveName || o.hive.roomName === hiveName) && (!masters || o.master)), (o) => o.print), (s) => console.log(s));
  }

  printBees(masterName?: string) {
    _.forEach(_.map(_.filter(Apiary.bees, (b) => !masterName || b.creep.memory.refMaster.includes(masterName)), (b) => b.print), (s) => console.log(s));
  }

  printSpawnOrders(hiveName?: string) {
    // i know this is messy, but this is print so it is ok
    return _.map(_.filter(Apiary.hives, (h) => !hiveName || h.roomName === hiveName), (h) => `${
      h.print
      }: \n${
      _.map(_.map(h.spawOrders, (order, master) => { return { order: order, master: master! } }).sort(
        (a, b) => a.order.priority - b.order.priority),
        (o) => `${o.order.priority} ${o.master}: ${o.order.setup.name} ${o.order.amount}`).join('\n')
      } \n`).join('\n');
  }
}
