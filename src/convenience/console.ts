import { makeId } from "../abstract/utils";
import { TERMINAL_ENERGY } from "../cells/stage1/storageCell";
import type { RoomSetup } from "../abstract/roomPlanner";

export class CustomConsole {
  vis(framerate?: number, force: number = 0) {
    if (Memory.settings.framerate && framerate === undefined)
      Memory.settings.framerate = 0;
    else
      Memory.settings.framerate = framerate ? framerate : (!Memory.settings.framerate ? 1 : 0);
    Memory.settings.forceBucket = force;
  }

  format(s: string) {
    if (/\d/.exec(s) !== null)
      return s.toUpperCase();
    else
      return s.toLowerCase();
  }

  // some hand used functions
  terminal(hiveName: string, amount: number = Infinity, resource: ResourceConstant = RESOURCE_ENERGY, mode: "fill" | "empty" = "fill") {
    hiveName = this.format(hiveName);
    let hive = Apiary.hives[hiveName];
    if (!hive)
      return `ERROR: NO HIVE @ <a href=#!/room/${Game.shard.name}/${hiveName}>${hiveName}</a>`;

    let cell = hive && hive.cells.storage;
    if (!cell || !cell.terminal)
      return `ERROR: TERMINAL NOT FOUND @ ${hive.print}`;

    if (!mode || (mode !== "fill" && mode !== "empty"))
      return `ERROR: NO VALID MODE @ ${hive.print}`;

    if (mode === "fill" && resource === RESOURCE_ENERGY && amount === Infinity)
      amount = Math.min(cell.terminal.store.getFreeCapacity(resource), 11000);

    if (mode === "empty" && resource === RESOURCE_ENERGY)
      amount -= TERMINAL_ENERGY;

    let ans;
    if (amount > 0)
      if (mode === "empty")
        ans = cell.requestToStorage("!USER_REQUEST", cell.terminal, 2, resource, Math.min(amount, cell.terminal.store.getUsedCapacity(resource)));
      else
        ans = cell.requestFromStorage("!USER_REQUEST", cell.terminal, 2, resource, Math.min(amount, cell.terminal.store.getFreeCapacity(resource)));

    return `${mode.toUpperCase()} TERMINAL @ ${hive.print} \nRESOURCE ${resource.toUpperCase()}: ${ans} `;
  }

  send(roomNameFrom: string, roomNameTo: string, amount: number = Infinity, resource: ResourceConstant = RESOURCE_ENERGY) {
    roomNameFrom = this.format(roomNameFrom);
    roomNameTo = this.format(roomNameTo);
    let hiveFrom = Apiary.hives[roomNameFrom];
    if (!hiveFrom)
      return `ERROR: NO HIVE @ <a href=#!/room/${Game.shard.name}/${roomNameFrom}>${roomNameFrom}</a>`;
    let terminalFrom = hiveFrom && hiveFrom.cells.storage && hiveFrom.cells.storage!.terminal;
    if (!terminalFrom)
      return `ERROR: FROM TERMINAL NOT FOUND @ ${hiveFrom.print}`;
    if (terminalFrom.cooldown > 0)
      return "TERMINAL COOLDOWN";
    let hiveTo = Apiary.hives[roomNameTo];
    if (!hiveTo)
      return `ERROR: NO HIVE @ <a href=#!/room/${Game.shard.name}/${roomNameFrom}>${roomNameFrom}</a>`;
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
    if (ans === OK && Apiary.logger)
      Apiary.logger.newTerminalTransfer(terminalFrom, terminalTo, amount, resource);

    let info = ` SEND FROM ${hiveFrom.print} TO ${hiveTo.print} \nRESOURCE ${resource.toUpperCase()}: ${amount
      } \nENERGY: ${Game.market.calcTransactionCost(amount, roomNameFrom, roomNameTo)}`;
    if (ans === OK)
      return "OK" + info;
    else
      return `ERROR: ${ans}` + info;
  }

  transfer(roomNameFrom: string, roomNameTo: string, res: ResourceConstant = RESOURCE_ENERGY, amount?: number) {
    console.log(this.terminal(roomNameFrom, amount, res, "fill"));
    console.log(this.terminal(roomNameTo, amount, res, "empty"));
    console.log(this.send(roomNameFrom, roomNameTo, amount, res));
  }

  completeOrder(orderId: string, roomName?: string, am: number = Infinity) {
    let order = Game.market.getOrderById(orderId);
    if (!order)
      return `ERROR: ORDER NOT FOUND`;
    if (order.type === ORDER_SELL && !am)
      return `AMOUNT NEEDED MAX: ${Math.min(order.amount, Math.floor(Game.market.credits / order.price))} `;

    let amount = Math.min(am, order.remainingAmount);
    let ans;
    let energy: number | string = "NOT NEEDED";
    let hiveName: string = "NO HIVE";
    if (!order.roomName) {
      ans = Game.market.deal(orderId, amount);
    } else {
      if (order.type === ORDER_SELL && order.price > 100)
        return "ORDER_PRICE IS STUPID HIGH";

      let resource = <ResourceConstant>order.resourceType;
      let hive;
      let validateTerminal = (t: StructureTerminal) =>
        (order!.type === ORDER_BUY && t.store.getUsedCapacity(resource) > amount)
        || (order!.type === ORDER_SELL && t.store.getFreeCapacity(resource) > amount);
      if (roomName)
        hive = Apiary.hives[roomName];
      else {
        let validHives = _.filter(Apiary.hives, (h) => h.cells.storage && h.cells.storage.terminal && validateTerminal(h.cells.storage.terminal));
        hive = validHives.reduce((prev, curr) => Game.market.calcTransactionCost(100, prev.roomName, order!.roomName!) >
          Game.market.calcTransactionCost(100, curr.roomName, order!.roomName!) ? curr : prev);
      }

      if (!hive)
        return `NO VALID HIVE FOUND${roomName ? " @ " + this.formatRoom(roomName) : ""}`;
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


    let info = ` ${order.type === ORDER_SELL ? "BOUGHT" : "SOLD"} @ ${hiveName}${order.roomName ? " from " + this.formatRoom(order.roomName) : ""
      }\nRESOURCE ${order.resourceType.toUpperCase()}: ${amount} \nMONEY: ${amount * order.price} \nENERGY: ${energy}`;
    if (ans === OK)
      return "OK" + info;
    else
      return `ERROR: ${ans}` + info;
  }

  buy(hiveName: string, resource: ResourceConstant, sets: number = 1, amount: number = 1500 * sets) {
    hiveName = hiveName.toUpperCase();
    let targetPrice = -1;
    let sum = 0, count = 0;
    let anchor = new RoomPosition(25, 25, hiveName);
    let orders = Game.market.getAllOrders((order) => {
      if (order.type === ORDER_BUY || order.resourceType !== resource || !order.roomName)
        return false;
      if (targetPrice < order.price)
        targetPrice = order.price;
      sum += order.price * order.amount;
      count += order.amount;
      return anchor.getRoomRangeTo(order.roomName!) < 50;
    })
    targetPrice = Math.min(targetPrice, (sum / count) * 1.2);
    if (orders.length)
      orders = orders.filter((order) => order.price < targetPrice * 0.9);
    if (orders.length) {
      let order = orders.reduce((prev, curr) => prev.price > curr.price ? curr : prev);
      return this.completeOrder(order.id, hiveName, amount);
    }
    return `NO GOOD DEAL FOR ${resource.toUpperCase()} : ${amount} @ ${this.formatRoom(hiveName)} `;
  }

  produce(hiveName: string, ...resource: string[]) {
    hiveName = hiveName.toUpperCase();
    let hive = Apiary.hives[hiveName];
    if (!hive)
      return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
    let cell = Apiary.hives[hiveName] && Apiary.hives[hiveName].cells.lab;
    if (!cell)
      return `ERROR: LAB NOT FOUND @ ${hive.print}`;

    for (let k in resource)
      resource[k] = resource[k].toUpperCase();
    let productionFlags = Game.rooms[hiveName].find(FIND_FLAGS, { filter: { color: COLOR_GREY, secondaryColor: COLOR_CYAN } });
    for (let k in productionFlags)
      resource = resource.concat(productionFlags[k].name.split("_"));
    resource.push(hiveName);
    let ref = resource.filter((value, index) => resource.indexOf(value) === index).join("_");
    let create = true;
    for (let k in productionFlags)
      if (ref !== productionFlags[k].name)
        productionFlags[k].remove()
      else {
        create = false;
      }
    if (create) {
      let pos = [new RoomPosition(cell.pos.x, cell.pos.y + 1, cell.pos.roomName), new RoomPosition(cell.pos.x, cell.pos.y - 1, cell.pos.roomName)]
        .filter((p) => p.lookFor(LOOK_FLAGS).length == 0)[0];
      if (pos)
        pos.createFlag(ref, COLOR_GREY, COLOR_CYAN);
      else
        return `ERROR: TOO MUCH FLAGS @ ${hive.print}`;
    } else
      return `ALREADY EXISTS @ ${hive.print}`;


    return `OK @ ${hive.print}`;
  }

  update(roomName: string, cache: RoomSetup) {
    if (!(roomName in Game.rooms))
      return `CANNOT ACCESS ${this.formatRoom(roomName)}`
    if (!Memory.cache.roomPlanner[roomName])
      return `NO PREVIOUS CACHE FOUND @ ${this.formatRoom(roomName)}`;

    if (!(roomName in Apiary.planner.activePlanning))
      Apiary.planner.toActive(roomName);

    for (let t in cache) {
      let val: BuildableStructureConstant | null = <BuildableStructureConstant>t;
      if (!(t in CONSTRUCTION_COST))
        if (t === "null")
          val = null;
        else
          continue;
      for (let i in cache[<BuildableStructureConstant>t]!.pos) {
        let pos = cache[<BuildableStructureConstant>t]!.pos[i];
        Apiary.planner.addToPlan(pos, roomName, val, true);
      }
    }
    let contr = Game.rooms[roomName].controller && Game.rooms[roomName].controller!.pos;
    let pos = contr && [new RoomPosition(contr.x, contr.y + 1, roomName), new RoomPosition(contr.x, contr.y - 1, roomName)]
      .filter((p) => p.lookFor(LOOK_FLAGS).length == 0)[0];
    if (pos)
      pos.createFlag("change_" + roomName + "_" + makeId(4), COLOR_WHITE, COLOR_CYAN);
    else
      return `ERROR: TOO MUCH FLAGS @ ${this.formatRoom(roomName)}`;

    return "OK";
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
    return "";
  }

  formatRoom(roomNae: string) {
    return `<a href=#!/room/${Game.shard.name}/${roomNae}>${roomNae}</a>`
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
