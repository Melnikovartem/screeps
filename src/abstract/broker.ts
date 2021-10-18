import { COMPRESS_MAP } from "../cells/stage1/factoryCell";

import { profile } from "../profiler/decorator";

export interface ProtoOrder {
  id: string,
  roomName: string,
  price: number,
  amount: number,
  resourceType: ResourceConstant;
  type: ORDER_BUY | ORDER_SELL;
}

const MAX_DEVIATION_PERCENT = 0.1;
const MAX_DEVIATION_PRICE = 10;

const ORDER_PADDING = 0.001;

const MAX_SPENDING_HIVE = 50000;
const SPENDING_PERIOD = 250;

type PriceStat = { [key in ResourceConstant]?: number };

@profile
export class Broker {

  // if it will become to heavy will switch to storing orderId

  // buy - i buy in resource
  goodBuy: { [key in ResourceConstant]?: ProtoOrder[] } = {};
  // sell - i sell resource
  goodSell: { [key in ResourceConstant]?: ProtoOrder[] } = {};

  bestPriceBuy: PriceStat = {};
  bestPriceSell: PriceStat = {};

  hiveSpending: { [id: string]: { credits: number, lastUpdated: number } } = {};

  energyPrice: number = Infinity;

  lastUpdated: number = -1;

  update() {
    if (this.lastUpdated === Game.time)
      return;

    // on shard2 during 10.2021 it took about 9.5CPU to calc all this
    // let cpu = Game.cpu.getUsed();
    this.lastUpdated = Game.time;
    this.goodBuy = {};
    this.goodSell = {};

    for (let roomName in this.hiveSpending)
      if (Game.time - this.hiveSpending[roomName].lastUpdated >= SPENDING_PERIOD)
        this.hiveSpending[roomName] = { credits: 0, lastUpdated: Game.time };

    let bestPriceBuy: PriceStat = {};
    let bestPriceSell: PriceStat = {};

    let orders = Game.market.getAllOrders();

    _.forEach(orders, order => {
      if (!order.roomName || !order.amount)
        return;
      let res = <ResourceConstant>order.resourceType;

      if (order.type === ORDER_BUY) {
        // they buy i sell
        if (!bestPriceSell[res] || bestPriceSell[res]! < order.price)
          bestPriceSell[res] = order.price;
      } else { // order.type === ORDER_SELL
        // they sell i buy
        if (!bestPriceBuy[res] || bestPriceBuy[res]! > order.price)
          bestPriceBuy[res] = order.price;
      }
    });

    _.forEach(orders, order => {
      if (!order.roomName || !order.amount)
        return;
      let res = <ResourceConstant>order.resourceType;

      if (order.type === ORDER_BUY) {
        // they buy i sell
        let deviation = Math.min(MAX_DEVIATION_PRICE, bestPriceSell[res]! * MAX_DEVIATION_PERCENT);
        if (order.price >= bestPriceSell[res]! - deviation) {
          if (!this.goodSell[res])
            this.goodSell[res] = [];
          this.goodSell[res]!.push(<ProtoOrder>order);
        }
      } else {
        // they sell i buy
        let deviation = Math.min(MAX_DEVIATION_PRICE, bestPriceBuy[res]! * MAX_DEVIATION_PERCENT);
        if (order.price <= bestPriceBuy[res]! + deviation) {
          if (!this.goodBuy[res])
            this.goodBuy[res] = [];
          this.goodBuy[res]!.push(<ProtoOrder>order);
        }
      }
    });

    for (let res in bestPriceSell)
      this.bestPriceSell[<ResourceConstant>res] = bestPriceSell[<ResourceConstant>res]!

    for (let res in bestPriceBuy)
      this.bestPriceBuy[<ResourceConstant>res] = bestPriceBuy[<ResourceConstant>res]!

    // coef to account for fact that energy is extremly unprofitable to cell cause of costs
    let energyToSell = this.bestPriceSell[RESOURCE_ENERGY] ? this.bestPriceSell[RESOURCE_ENERGY]! * 0.4353 : Infinity;
    let energyToBuy = this.bestPriceBuy[RESOURCE_ENERGY] ? this.bestPriceBuy[RESOURCE_ENERGY]! : Infinity;
    // later will be used to calc is it even profitable to sell something faraway
    this.energyPrice = Math.min(energyToBuy, energyToSell);

    /*
    for (let res in this.bestPriceBuy) {
      let r = <ResourceConstant>res;
      let amountBuy = this.goodBuy[r] ? this.goodBuy[r]!.length : 0;
      let amountSell = this.goodSell[r] ? this.goodSell[r]!.length : 0;
      console .log(`${res} buy: ${this.bestPriceBuy[r]} @ ${amountBuy} sell: ${this.bestPriceSell[r]} @ ${amountSell}`)
    }
    console .log("order update\ncpu used: " + (Game.cpu.getUsed() - cpu));
    console .log(`transfer energy buyLimit ${energyToBuy} sellLimit ${energyToSell}`);
    */

    for (let id in Game.market.orders)
      if (!Game.market.orders[id].remainingAmount)
        Game.market.cancelOrder(id);
  }

  getTargetLongOrders(roomName: string) {
    let orders = _.filter(Game.market.orders, o => o.roomName === roomName);
    let ans: { [key in ResourceConstant]?: number } = {}
    _.forEach(orders, o => {
      if (o.type === ORDER_BUY || !o.remainingAmount || !o.roomName)
        return;
      let res = <ResourceConstant>o.resourceType;
      if (!ans[res])
        ans[res] = 0
      ans[res]! += o.remainingAmount
    });
    return ans;
  }

  buyIn(terminal: StructureTerminal, res: ResourceConstant, amount: number, hurry = false, creditsToUse?: number): "no money" | "short" | "long" {
    let roomName = terminal.pos.roomName;
    if (creditsToUse === undefined)
      creditsToUse = this.creditsToUse(roomName);
    if (creditsToUse <= 0)
      return "no money";

    this.update();
    let price = this.getPriceLongBuy(res);
    let priceToBuyInstant = this.bestPriceBuy[res] ? this.bestPriceBuy[res]! : Infinity;

    if (res === RESOURCE_ENERGY)
      priceToBuyInstant *= 1.5654; // approx transfer costs


    if (hurry || priceToBuyInstant <= price * 1.05) {
      let ans: number = ERR_NOT_ENOUGH_RESOURCES;
      if (Math.floor(creditsToUse / priceToBuyInstant))
        ans = this.buyShort(terminal, res, amount, creditsToUse);
      if (ans === OK)
        return "short";
    }

    let orders = _.filter(Game.market.orders, order => order.roomName === roomName && order.resourceType === res && order.type === ORDER_BUY);

    if (!orders.length && Math.floor(creditsToUse / (price * 1.05)) > 0)
      this.buyLong(terminal, res, amount, creditsToUse);
    else {
      let o = orders.sort((a, b) => a.created - b.created)[0];
      let newPrice = o.price + ORDER_PADDING * 4; // cant set to 1 cause case where i am the best price
      if (newPrice <= price && priceToBuyInstant >= newPrice * 1.1)
        Game.market.changeOrderPrice(o.id, newPrice);
    }
    return "long";
  }

  sellOff(terminal: StructureTerminal, res: ResourceConstant, amount: number, hurry = false, creditsToUse?: number): "no money" | "short" | "long" {
    let roomName = terminal.pos.roomName;
    if (creditsToUse === undefined)
      creditsToUse = this.creditsToUse(roomName);
    if (creditsToUse <= 0)
      return "no money";

    this.update();
    let price = this.getPriceLongSell(res);
    let priceToSellInstant = this.bestPriceSell[res] ? this.bestPriceSell[res]! : Infinity;

    if (hurry || priceToSellInstant >= price * 0.95) {
      let ans = this.sellShort(terminal, res, amount);
      if (ans === OK)
        return "short";
    }

    let orders = _.filter(Game.market.orders, order => order.roomName === roomName && order.resourceType === res && order.type === ORDER_SELL);

    if (!orders.length)
      this.sellLong(terminal, res, amount, creditsToUse);
    else {
      let o = orders.sort((a, b) => a.created - b.created)[0];
      let newPrice = o.price - ORDER_PADDING * 4; // cant set to 1 cause case where i am the best price
      if (newPrice >= price && priceToSellInstant <= newPrice * 0.9)
        Game.market.changeOrderPrice(o.id, newPrice);
    }
    return "long";
  }

  creditsToUse(roomName: string) {
    if (!this.hiveSpending[roomName])
      this.hiveSpending[roomName] = { credits: 0, lastUpdated: Game.time }
    return Math.min(MAX_SPENDING_HIVE - this.hiveSpending[roomName].credits, Game.market.credits - Memory.settings.minBalance);
  }

  // i buy as long
  getPriceLongBuy(res: ResourceConstant) {
    return (this.bestPriceSell[res] ? this.bestPriceSell[res]! : 0) + ORDER_PADDING;
  }

  // i sell as long
  getPriceLongSell(res: ResourceConstant) {
    return (this.bestPriceBuy[res] ? this.bestPriceBuy[res]! : 0) - ORDER_PADDING;
  }

  buyLong(terminal: StructureTerminal, res: ResourceConstant, amount: number, creditsToUse: number, coef: number = 1) {
    this.update();
    let price = this.getPriceLongBuy(res) * coef;
    let roomName = terminal.pos.roomName;
    let priceCap = Math.floor(creditsToUse / (price * 1.05));
    amount = Math.min(amount, priceCap);
    if (!amount)
      return ERR_NOT_ENOUGH_RESOURCES;
    let ans = Game.market.createOrder({
      type: ORDER_BUY,
      resourceType: res,
      totalAmount: amount,
      price: price,
      roomName: roomName,
    });
    if (ans === OK)
      this.hiveSpending[roomName].credits += amount * price * 1.05;
    return ans;
  }

  sellLong(terminal: StructureTerminal, res: ResourceConstant, creditsToUse: number, amount: number, coef: number = 1) {
    this.update();
    let price = this.getPriceLongSell(res) * coef;
    let roomName = terminal.pos.roomName;
    let priceCap = Math.floor(creditsToUse / (price * 0.05));
    amount = Math.min(amount, priceCap);
    if (!amount)
      return ERR_NOT_ENOUGH_RESOURCES;
    let ans = Game.market.createOrder({
      type: ORDER_SELL,
      resourceType: res,
      totalAmount: amount,
      price: price,
      roomName: roomName,
    });
    return ans;
  }

  buyShort(terminal: StructureTerminal, res: ResourceConstant, amount: number, creditsToUse: number) {
    if (terminal.cooldown)
      return ERR_TIRED;
    this.update();
    let orders = this.goodBuy[res];
    if (!orders)
      return ERR_NOT_FOUND;
    if (!_.filter(COMPRESS_MAP, r => r === res).length)
      orders = orders.filter(order => terminal.pos.getRoomRangeTo(order.roomName) <= 30)
    if (!orders.length)
      return ERR_NOT_FOUND;

    let roomName = terminal.pos.roomName;
    let order = orders.reduce((prev, curr) => curr.price > prev.price ? curr : prev);
    let energyCost = Game.market.calcTransactionCost(10000, roomName, order.roomName) / 10000;
    let energyCap = Math.floor(terminal.store.getUsedCapacity(RESOURCE_ENERGY) / energyCost);
    let priceCap = Math.floor(creditsToUse / order.price);

    amount = Math.min(amount, energyCap, order.amount, priceCap, terminal.store.getFreeCapacity(res));
    if (!amount)
      return ERR_NOT_ENOUGH_RESOURCES;

    let ans = Game.market.deal(order.id, amount, roomName);
    if (ans === OK) {
      this.hiveSpending[roomName].credits += amount * order.price;
      if (Apiary.logger)
        Apiary.logger.newMarketOperation(order, amount, roomName);
    }
    return ans;
  }

  sellShort(terminal: StructureTerminal, res: ResourceConstant, amount: number) {
    if (terminal.cooldown)
      return ERR_TIRED;
    this.update();
    let orders = this.goodSell[res];
    if (!orders)
      return ERR_NOT_FOUND;
    if (!_.filter(COMPRESS_MAP, r => r === res).length)
      orders = orders.filter(order => terminal.pos.getRoomRangeTo(order.roomName) <= 30)
    if (!orders.length)
      return ERR_NOT_FOUND;

    let roomName = terminal.pos.roomName;
    let order = orders.reduce((prev, curr) => curr.price > prev.price ? curr : prev);
    let energyCost = Game.market.calcTransactionCost(10000, roomName, order.roomName) / 10000;
    let energyCap = Math.floor(terminal.store.getUsedCapacity(RESOURCE_ENERGY) / energyCost);
    amount = Math.min(amount, energyCap, order.amount, terminal.store.getUsedCapacity(res));

    if (res === RESOURCE_ENERGY && amount * (1 + energyCost) > terminal.store.getUsedCapacity(RESOURCE_ENERGY))
      amount = Math.floor(amount * (1 - energyCost));

    if (!amount)
      return ERR_NOT_ENOUGH_RESOURCES;

    let ans = Game.market.deal(order.id, amount, roomName);
    if (ans === OK) {
      terminal.cooldown = 10;
      if (Apiary.logger)
        Apiary.logger.newMarketOperation(order, amount, roomName);
    }
    return ans;
  }
}
