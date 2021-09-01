export class CustomConsole {

  vis(framerate: number = 1) {
    if (Memory.settings.framerate)
      Memory.settings.framerate = 0;
    else
      Memory.settings.framerate = framerate;
  }

  // some hand used functions
  terminal(roomName: string, resource: ResourceConstant = RESOURCE_ENERGY, amount: number = Infinity, mode?: "fill" | "empty") {
    let cell = Apiary.hives[roomName] && Apiary.hives[roomName].cells.storage;
    if (!cell || !cell.terminal)
      return `ERROR: TERMINAL NOT FOUND @ ${roomName}`;

    if (!mode) {
      if (cell.storage.store.getUsedCapacity(resource) >= (amount === Infinity ? 1 : amount))
        mode = "fill";
      if (cell.terminal.store.getUsedCapacity(resource) >= (amount === Infinity ? 1 : amount)) {
        if (mode === "fill") {
          if (resource !== RESOURCE_ENERGY)
            return `CAN'T DESIDE ON MODE @ ${roomName}`;
        } else
          mode = "empty";
      }
    }

    if (!mode || (mode !== "fill" && mode !== "empty"))
      return `NO VALID MODE FOUND @ ${roomName}`;

    if (mode === "fill" && resource === RESOURCE_ENERGY && amount === Infinity)
      amount = Math.min(cell.terminal.store.getFreeCapacity(resource), 100000);

    let ans;
    if (mode === "empty")
      ans = cell.requestToStorage("!USER_REQUEST", [cell.terminal], 2, [resource], [amount]);
    else
      ans = cell.requestFromStorage("!USER_REQUEST", [cell.terminal], 2, [resource], [amount]);

    return `${mode.toUpperCase()} TERMINAL @ ${roomName} \nRESOURCE ${resource}: ${ans} `;
  }

  terminalSend(roomNameFrom: string, roomNameTo: string, resource: ResourceConstant = RESOURCE_ENERGY, amount: number = Infinity) {
    let terminalFrom = Apiary.hives[roomNameFrom] && Apiary.hives[roomNameFrom].cells.storage && Apiary.hives[roomNameFrom].cells.storage!.terminal;
    if (!terminalFrom)
      return `ERROR: FROM TERMINAL NOT FOUND @ ${roomNameFrom}`;
    if (terminalFrom.cooldown > 0)
      return "TERMINAL COOLDOWN";
    let terminalTo = Apiary.hives[roomNameTo] && Apiary.hives[roomNameTo].cells.storage && Apiary.hives[roomNameTo].cells.storage!.terminal;
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
    if (ans === OK)
      return `SEND FROM ${roomNameFrom} TO ${roomNameTo} \nRESOURCE ${resource}: ${amount
        } \nENERGY: ${Game.market.calcTransactionCost(amount, roomNameFrom, roomNameTo)} `;
    else if (ans === ERR_NOT_ENOUGH_RESOURCES)
      return `NOT ENOUGHT RESOURSES TO SEND FROM ${roomNameFrom} TO ${roomNameTo
        } \nRESOURCE ${resource}: ${amount} \nENERGY: ${Game.market.calcTransactionCost(amount, roomNameFrom, roomNameTo)} `;
    return ans;
  }

  transfer(roomNameFrom: string, roomNameTo: string, res: ResourceConstant = RESOURCE_ENERGY, amount?: number) {
    console.log(this.terminal(roomNameFrom, res, amount, "fill"));
    console.log(this.terminal(roomNameTo, res, amount, "empty"));
    console.log(this.terminalSend(roomNameFrom, roomNameTo, res, amount));
  }

  completeOrder(orderId: string, am?: number) {
    let order = Game.market.getOrderById(orderId);
    if (!order)
      return "ORDER NOT FOUND";
    if (order.type === ORDER_SELL && !am)
      return `AMOUNT NEEDED.MAX: ${Math.min(order.amount, Math.floor(Game.market.credits / order.price))} `;

    let amount = am ? am : order.remainingAmount;
    let ans;
    let energy: number | string = "NOT NEEDED";
    let hiveName: string = "global";
    if (!order.roomName) {
      ans = Game.market.deal(orderId, amount);
    } else {
      let resource = <ResourceConstant>order.resourceType;
      let validHives = _.filter(Apiary.hives, (h) => h.cells.storage && h.cells.storage.terminal
        && ((order!.type === ORDER_BUY && h.cells.storage.terminal.store.getUsedCapacity(resource) > amount)
          || (order!.type === ORDER_SELL && h.cells.storage.terminal.store.getFreeCapacity(resource) > amount)));

      validHives.sort((a, b) => Game.market.calcTransactionCost(amount, a.roomName, order!.roomName!) -
        Game.market.calcTransactionCost(amount, b.roomName, order!.roomName!));

      let terminal = validHives[0].cells.storage!.terminal!;

      if (order.type === ORDER_BUY)
        amount = Math.min(amount, terminal.store.getUsedCapacity(resource));
      else
        amount = Math.min(amount, terminal.store.getFreeCapacity(resource));

      hiveName = terminal.pos.roomName;

      energy = Game.market.calcTransactionCost(amount, terminal.pos.roomName, order.roomName);
      ans = Game.market.deal(orderId, amount, terminal.pos.roomName);
    }

    if (ans === OK)
      return `OK ${order.type === ORDER_SELL ? "BOUGHT" : "SOLD"} @${hiveName} \nRESOURCE ${
        order.resourceType
        }: ${amount} \nMONEY: ${amount * order.price} \nENERGY: ${energy} `;
    else if (ans === ERR_NOT_ENOUGH_RESOURCES)
      return `NOT ENOUGHT RESOURSES TO ${
        order.type === ORDER_SELL ? "BUY" : "SELL"
        } \nRESOURCE ${order.resourceType}: ${amount} \nMONEY: ${amount * order.price} \nENERGY: ${energy} `;
    return ans;
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
