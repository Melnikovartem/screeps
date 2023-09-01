import { REACTION_MAP } from "../../cells/stage1/laboratoryCell";
import { TERMINAL_ENERGY } from "../../cells/stage1/storageCell";
import { CustomConsole } from "./console";

// PROB REMOVE ALL FUNCTIONS FROM THIS FILE AT SOME TIME

declare module "./console" {
  export interface CustomConsole {
    /**
     * Manages terminal resources by filling or emptying it.
     * @param hiveName - Name of the hive to perform the operation.
     * @param amount - Amount of resources to manage.
     * @param resource - The resource type to manage.
     * @param mode - The mode of operation (fill or empty).
     * @returns Result message of the operation.
     */
    terminal(
      hiveName?: string,
      amount?: number,
      resource?: ResourceConstant,
      mode?: "fill" | "empty"
    ): string;

    /**
     * Sends resources from one room to another.
     * @param roomNameFrom - Name of the sending room.
     * @param roomNameTo - Name of the receiving room.
     * @param resource - The resource type to send.
     * @param amount - Amount of resources to send.
     * @returns Result message of the sending operation.
     */
    send(
      roomNameFrom: string,
      roomNameTo: string,
      resource?: ResourceConstant,
      amount?: number
    ): string;

    /**
     * Sends resources from one room to another without checking balances.
     * @param roomNameFrom - Name of the sending room.
     * @param roomNameTo - Name of the receiving room.
     * @param resource - The resource type to send.
     * @param amount - Amount of resources to send.
     * @returns Result message of the sending operation.
     */
    sendBlind(
      roomNameFrom: string,
      roomNameTo: string,
      resource: ResourceConstant,
      amount?: number
    ): string;

    /**
     * Transfers resources from one room to another using the terminal.
     * @param roomNameFrom - Name of the sending room.
     * @param roomNameTo - Name of the receiving room.
     * @param res - The resource type to transfer.
     * @param amount - Amount of resources to transfer.
     */
    transfer(
      roomNameFrom: string,
      roomNameTo: string,
      res?: ResourceConstant,
      amount?: number
    ): void;

    /**
     * Changes the price of an existing market order.
     * @param orderId - ID of the order to change.
     * @param newPrice - New price for the order.
     * @returns Result message of the order change.
     */
    changeOrderPrice(orderId: string, newPrice: number): string;

    /**
     * Cancels orders in a specific hive.
     * @param hiveName - Name of the hive to cancel orders in.
     * @param active - Whether to cancel only active orders.
     * @returns Result message of the cancellation.
     */
    cancelOrdersHive(hiveName?: string, active?: boolean): string;

    /**
     * Cancels a specific market order.
     * @param orderId - ID of the order to cancel.
     * @returns Result message of the order cancellation.
     */
    cancelOrder(orderId: string): string;
    /**
     * Completes an order by buying or selling resources on the market.
     * @param orderId - ID of the order to complete.
     * @param roomName - Optional room name for transaction.
     * @param sets - Number of sets to buy/sell.
     * @returns Result message of the transaction.
     */
    completeOrder(orderId: string, roomName?: string, sets?: number): string;
    /**
     * Retrieves a terminal in the specified room.
     * @param roomName - The room to look for the terminal.
     * @param checkCooldown - Whether to check for terminal cooldown.
     * @returns The terminal or an error message.
     */
    getTerminal(
      roomName: string,
      checkCooldown?: boolean
    ): StructureTerminal | string;

    /**
     * Buys master's minerals for a hive.
     * @param hiveName - Name of the hive to perform the transaction.
     * @param padding - Additional amount to consider while buying.
     * @param mode - Transaction mode (fast/better price).
     * @returns Result message of the transactions.
     */
    buyMastersMinerals(
      hiveName?: string,
      padding?: number,
      mode?: boolean
    ): string;

    /**
     * Buys resources from the market using a terminal.
     * @param resource - The resource to buy.
     * @param hiveName - Name of the hive to perform the transaction.
     * @param sets - Number of sets to buy.
     * @param hurry - Whether to prioritize the transaction.
     * @returns Result message of the transaction.
     */
    buy(
      resource: ResourceConstant,
      hiveName?: string,
      sets?: number,
      hurry?: boolean
    ): string;

    /**
     * Sells resources to the market using a terminal.
     * @param resource - The resource to sell.
     * @param hiveName - Name of the hive to perform the transaction.
     * @param sets - Number of sets to sell.
     * @param hurry - Whether to prioritize the transaction.
     * @returns Result message of the transaction.
     */
    sell(
      resource: ResourceConstant,
      hiveName?: string,
      sets?: number,
      hurry?: boolean
    ): string;
  }
}

CustomConsole.prototype.terminal = function (
  hiveName?: string,
  amount: number = Infinity,
  resource: ResourceConstant = RESOURCE_ENERGY,
  mode: "fill" | "empty" = "fill"
) {
  if (hiveName === undefined) hiveName = this.lastActionRoomName;
  hiveName = this.format(hiveName);
  const hive = Apiary.hives[hiveName];
  if (!hive) return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
  this.lastActionRoomName = hive.roomName;

  const cell = hive && hive.cells.storage;
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
      ans = cell.requestToStorage(
        [cell.terminal],
        1,
        resource,
        Math.min(amount, cell.terminal.store.getUsedCapacity(resource))
      );
    else
      ans = cell.requestFromStorage(
        [cell.terminal],
        1,
        resource,
        Math.min(amount, cell.terminal.store.getFreeCapacity(resource))
      );

  return `${mode.toUpperCase()} TERMINAL @ ${
    hive.print
  } \nRESOURCE ${resource.toUpperCase()}: ${ans} `;
};

CustomConsole.prototype.sendBlind = function (
  roomNameFrom: string,
  roomNameTo: string,
  resource: ResourceConstant,
  amount: number = Infinity,
  message = "🐝"
) {
  roomNameFrom = this.format(roomNameFrom);
  roomNameTo = this.format(roomNameTo);
  const hiveFrom = Apiary.hives[roomNameFrom];
  if (!hiveFrom)
    return `ERROR: NO HIVE @ <a href=#!/room/${Game.shard.name}/${roomNameFrom}>${roomNameFrom}</a>`;
  const terminalFrom =
    hiveFrom && hiveFrom.cells.storage && hiveFrom.cells.storage.terminal;
  if (!terminalFrom)
    return `ERROR: FROM TERMINAL NOT FOUND @ ${hiveFrom.print}`;
  if (terminalFrom.cooldown > 0) return "TERMINAL COOLDOWN";

  amount = Math.min(amount, terminalFrom.store.getUsedCapacity(resource));

  const energyCost =
    Game.market.calcTransactionCost(10000, roomNameFrom, roomNameTo) / 10000;
  const energyCap = Math.floor(
    terminalFrom.store.getUsedCapacity(RESOURCE_ENERGY) / energyCost
  );
  amount = Math.min(amount, energyCap);

  if (
    resource === RESOURCE_ENERGY &&
    amount * (1 + energyCost) >
      terminalFrom.store.getUsedCapacity(RESOURCE_ENERGY)
  )
    amount = Math.floor(amount * (1 - energyCost));

  const ans = terminalFrom.send(resource, amount, roomNameTo, message);

  const info = ` SEND FROM ${
    hiveFrom.print
  } TO ${roomNameTo} \nRESOURCE ${resource.toUpperCase()}: ${amount} \nENERGY: ${Game.market.calcTransactionCost(
    amount,
    roomNameFrom,
    roomNameTo
  )}`;
  if (ans === OK) return "OK" + info;
  else return `ERROR: ${ans}` + info;
};

CustomConsole.prototype.send = function (
  roomNameFrom: string,
  roomNameTo: string,
  resource: ResourceConstant = RESOURCE_ENERGY,
  amount: number = Infinity
) {
  roomNameFrom = this.format(roomNameFrom);
  roomNameTo = this.format(roomNameTo);
  const hiveFrom = Apiary.hives[roomNameFrom];
  if (!hiveFrom)
    return `ERROR: NO HIVE @ <a href=#!/room/${Game.shard.name}/${roomNameFrom}>${roomNameFrom}</a>`;
  const terminalFrom =
    hiveFrom && hiveFrom.cells.storage && hiveFrom.cells.storage.terminal;
  if (!terminalFrom)
    return `ERROR: FROM TERMINAL NOT FOUND @ ${hiveFrom.print}`;
  if (terminalFrom.cooldown > 0) return "TERMINAL COOLDOWN";
  const hiveTo = Apiary.hives[roomNameTo];
  if (!hiveTo)
    return `ERROR: NO HIVE @ <a href=#!/room/${Game.shard.name}/${roomNameFrom}>${roomNameFrom}</a>`;
  const terminalTo =
    hiveTo && hiveTo.cells.storage && hiveTo.cells.storage.terminal;
  if (!terminalTo) return `ERROR: TO TERMINAL NOT @ ${roomNameTo}`;

  amount = Math.min(amount, terminalFrom.store.getUsedCapacity(resource));
  amount = Math.min(amount, terminalTo.store.getFreeCapacity(resource));

  const energyCost =
    Game.market.calcTransactionCost(10000, roomNameFrom, roomNameTo) / 10000;
  const energyCap = Math.floor(
    terminalFrom.store.getUsedCapacity(RESOURCE_ENERGY) / energyCost
  );
  amount = Math.min(amount, energyCap);

  if (
    resource === RESOURCE_ENERGY &&
    amount * (1 + energyCost) >
      terminalFrom.store.getUsedCapacity(RESOURCE_ENERGY)
  )
    amount = Math.floor(amount * (1 - energyCost));

  const ans = terminalFrom.send(resource, amount, roomNameTo);
  if (ans === OK)
    Apiary.logger.newTerminalTransfer(
      terminalFrom,
      terminalTo,
      amount,
      resource
    );

  const info = ` SEND FROM ${hiveFrom.print} TO ${
    hiveTo.print
  } \nRESOURCE ${resource.toUpperCase()}: ${amount} \nENERGY: ${Game.market.calcTransactionCost(
    amount,
    roomNameFrom,
    roomNameTo
  )}`;
  if (ans === OK) return "OK" + info;
  else return `ERROR: ${ans}` + info;
};

// spam to tranfer // from my early days
CustomConsole.prototype.transfer = function (
  roomNameFrom: string,
  roomNameTo: string,
  res: ResourceConstant = RESOURCE_ENERGY,
  amount?: number
) {
  console.log(this.terminal(roomNameFrom, amount, res, "fill"));
  console.log(this.terminal(roomNameTo, amount, res, "empty"));
  console.log(this.send(roomNameFrom, roomNameTo, res, amount));
};

CustomConsole.prototype.changeOrderPrice = function (
  orderId: string,
  newPrice: number
) {
  return marketReturn(
    Game.market.changeOrderPrice(orderId, newPrice),
    "ORDER CHANGE TO " + newPrice
  );
};

CustomConsole.prototype.cancelOrdersHive = function (hiveName, active = false) {
  if (hiveName === undefined) hiveName = this.lastActionRoomName;
  let ans = `OK @ ${this.format(hiveName)}`;
  _.forEach(Game.market.orders, (o) => {
    if (o.roomName === hiveName && (!o.active || active))
      ans +=
        marketReturn(
          Apiary.broker.cancelOrder(o.id),
          `canceled ${o.resourceType}`
        ) + "\n";
  });
  return ans;
};

CustomConsole.prototype.cancelOrder = function (orderId: string) {
  return marketReturn(Apiary.broker.cancelOrder(orderId), "ORDER CANCEL");
};

CustomConsole.prototype.completeOrder = function (
  orderId: string,
  roomName?: string,
  sets: number = 1
) {
  const order = Game.market.getOrderById(orderId);
  if (!order) return `ERROR: ORDER NOT FOUND`;
  let amount = Math.min(sets * 5000, order.amount);
  let ans;
  let energy: number | string = "NOT NEEDED";
  let hiveName: string = "NO HIVE";
  if (!order.roomName) {
    ans = Game.market.deal(orderId, amount);
  } else {
    const resource = order.resourceType as ResourceConstant;

    let terminal;
    let validateTerminal = (t: StructureTerminal) =>
      t.store.getUsedCapacity(resource) > amount;
    if (order.type === ORDER_SELL)
      validateTerminal = (t) => t.store.getFreeCapacity(resource) > amount;

    if (roomName)
      terminal = this.getTerminal(roomName, order.type === ORDER_BUY);
    else {
      const validHives = _.filter(
        Apiary.hives,
        (h) =>
          h.cells.storage &&
          h.cells.storage.terminal &&
          validateTerminal(h.cells.storage.terminal)
      );
      if (!validHives.length) return "NO VALID HIVES FOUND";

      const hive = validHives.reduce((prev, curr) =>
        Game.market.calcTransactionCost(100, prev.roomName, order.roomName!) >
        Game.market.calcTransactionCost(100, curr.roomName, order.roomName!)
          ? curr
          : prev
      );
      terminal = hive.cells.storage!.terminal!;
    }

    if (typeof terminal === "string") return terminal;

    hiveName = this.formatRoom(terminal.pos.roomName);

    if (order.type === ORDER_BUY)
      amount = Math.min(amount, terminal.store.getUsedCapacity(resource));
    else amount = Math.min(amount, terminal.store.getFreeCapacity(resource));

    energy = Game.market.calcTransactionCost(
      amount,
      terminal.pos.roomName,
      order.roomName
    );
    ans = Game.market.deal(orderId, amount, terminal.pos.roomName);
    if (ans === OK && order.roomName)
      Apiary.logger.marketShortRes(order, amount, terminal.pos.roomName);
  }

  const info = `${order.type === ORDER_SELL ? "BOUGHT" : "SOLD"} @ ${hiveName}${
    order.roomName ? " from " + this.formatRoom(order.roomName) : ""
  }\nRESOURCE ${order.resourceType.toUpperCase()}: ${amount} \nMONEY: ${
    amount * order.price
  } \nENERGY: ${energy}`;

  return marketReturn(ans, info);
};

CustomConsole.prototype.getTerminal = function (
  roomName: string,
  checkCooldown = false
) {
  const hive = Apiary.hives[roomName];
  if (!hive) return `NO VALID HIVE FOUND @ ${this.formatRoom(roomName)}`;
  this.lastActionRoomName = hive.roomName;
  const terminal = hive.cells.storage && hive.cells.storage.terminal!;
  if (!terminal) return `NO VALID TERMINAL NOT FOUND @ ${hive.print}`;
  if (checkCooldown && terminal.cooldown) return `TERMINAL COOLDOWN`;
  return terminal;
};

CustomConsole.prototype.buyMastersMinerals = function (
  hiveName?: string,
  padding = 0,
  fast = true
) {
  if (hiveName === undefined) hiveName = this.lastActionRoomName;
  const hive = Apiary.hives[hiveName];
  if (!hive) return `NO VALID HIVE FOUND @ ${this.formatRoom(hiveName)}`;
  const state = hive.mastersResTarget;
  let ans = `OK @ ${this.format(hiveName)}`;
  let skip = !hive.room.terminal || !!hive.room.terminal.cooldown;
  _.forEach(state, (amount, r) => {
    if (!amount || !r || r === RESOURCE_ENERGY) return;
    const res = r as ResourceConstant;
    if (!(res in REACTION_MAP) || hive.resState[res]! > 0) return;
    if (skip) {
      ans += `\n${res}: skipped ${amount}`;
      return;
    }
    const sets = Math.min(
      Math.round(((amount + padding) / 5000) * 1000) / 1000,
      1
    );
    const buyAns = this.buy(res, hiveName, sets, fast);
    skip = buyAns.includes("short");
    ans += `\n${res}: ${buyAns} ${sets * 5000}/${amount}`;
  });
  return ans;
};

CustomConsole.prototype.buy = function (
  resource: ResourceConstant,
  hiveName?: string,
  sets: number = 1,
  hurry: boolean = true
) {
  if (hiveName === undefined) hiveName = this.lastActionRoomName;
  hiveName = hiveName.toUpperCase();
  const terminal = this.getTerminal(hiveName);
  if (typeof terminal === "string") return terminal;
  const amount = 5000 * sets;

  const info = Apiary.broker.updateRes(resource, 0);
  const priceToBuyLong = info.bestPriceSell || info.avgPrice;
  const priceToBuyInstant = info.bestPriceBuy || info.avgPrice;
  const loss =
    (priceToBuyInstant +
      Apiary.broker.energyPrice * 0.7 -
      priceToBuyLong * (1 + 0.05)) *
    amount;
  return marketReturn(
    Apiary.broker.buyIn(terminal, resource, 5000 * sets, hurry),
    `: LOSS FOR SHORT ${loss} : ${resource.toUpperCase()} @ ${this.formatRoom(
      hiveName
    )}`
  );
};

CustomConsole.prototype.sell = function (
  resource: ResourceConstant,
  hiveName?: string,
  sets: number = 1,
  hurry: boolean = true
) {
  if (hiveName === undefined) hiveName = this.lastActionRoomName;
  hiveName = hiveName.toUpperCase();
  const terminal = this.getTerminal(hiveName);
  if (typeof terminal === "string") return terminal;
  const amount = 5000 * sets;

  const info = Apiary.broker.updateRes(resource, 0);
  const priceToSellLong = info.bestPriceBuy || info.avgPrice;
  const priceToSellInstant = info.bestPriceSell || info.avgPrice;
  const loss =
    (priceToSellLong * (1 + 0.05) +
      Apiary.broker.energyPrice * 0.7 -
      priceToSellInstant) *
    amount;

  return marketReturn(
    Apiary.broker.sellOff(terminal, resource, amount, hurry),
    `: LOSS FOR SHORT ${loss} : ${resource.toUpperCase()} @ ${this.formatRoom(
      hiveName
    )}`
  );
};

/**
 * Handles the result of a market transaction and provides a formatted message.
 * @param ans - Result code or message of the transaction.
 * @param info - Additional information about the transaction.
 * @returns Formatted result message.
 */
function marketReturn(ans: number | string, info: string) {
  switch (ans) {
    case ERR_NOT_FOUND:
      ans = "NO GOOD DEAL NEAR";
      break;
    case ERR_NOT_ENOUGH_RESOURCES:
      ans = "NOT ENOUGH RESOURCES";
      break;
    case OK:
      return "OK " + info;
  }
  return `${typeof ans === "number" ? "ERROR: " : ""}${ans} ` + info;
}
