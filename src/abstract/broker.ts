import {
  ReactionConstant,
  USEFUL_MINERAL_STOCKPILE,
} from "cells/stage1/laboratoryCell";

import { COMMODITIES_TO_SELL } from "../cells/stage1/factoryCell";
import { profile } from "../profiler/decorator";

export interface ProtoOrder {
  id: string;
  roomName: string;
  price: number;
  amount: number;
  resourceType: ResourceConstant;
  type: ORDER_BUY | ORDER_SELL;
}

const MAX_DEVIATION_PERCENT = 0.1;
const MAX_DEVIATION_PRICE = 10;

const ORDER_PADDING = 0.001;
const MARKET_FEE = 0.05;

const CREDIT_THRESHOLD_SLOW = 50000000;

const REASONABLE_MONEY = 50;
export const MARKET_LAG = Game.cpu.limit <= 20 ? 8 : 2;

/* const MAX_SPENDING_HIVE = 50000;
const SPENDING_PERIOD = 250; */

type PriceStat = { [key in ResourceConstant]?: number };

@profile
export class Broker {
  // if it will become to heavy will switch to storing orderId

  public profitableCompunds: ReactionConstant[] = [];

  private info: {
    [key in ResourceConstant]?: {
      // buy - i buy in resource
      goodBuy: ProtoOrder[];
      // sell - i sell resource
      goodSell: ProtoOrder[];
      bestPriceBuy?: number;
      bestPriceSell?: number;
      // avg price of past 2 days
      avgPrice: number;
      lastUpdated: number;
    };
  } = {};

  public shortOrdersSell: {
    [roomName: string]: { orders: PriceStat; lastUpdated: number };
  } = {};
  private energyPrice: number = Infinity;

  private updateRes(res: ResourceConstant, lag: number = 0) {
    let info = this.info[res]!;
    if (info && info.lastUpdated + lag >= Game.time) return info;

    // on shard2 during 10.2021 it took about 10.5CPU to calc all this
    // let cpu = Game.cpu.getUsed();
    if (!info) {
      this.info[res] = {
        goodBuy: [],
        goodSell: [],
        lastUpdated: Game.time,
        avgPrice: this.weightedAvgPrice(res),
      };
      info = this.info[res]!;
    }
    info.lastUpdated = Game.time;
    info.goodBuy = [];
    info.goodSell = [];

    info.bestPriceBuy = undefined;
    info.bestPriceSell = undefined;

    const orders = Game.market.getAllOrders({ resourceType: res });

    _.forEach(orders, (order) => {
      if (!order.roomName || !order.amount || order.id in Game.market.orders)
        return;
      if (order.type === ORDER_BUY) {
        // they buy i sell
        if (
          info.bestPriceSell === undefined ||
          info.bestPriceSell < order.price
        )
          info.bestPriceSell = order.price;
      } else {
        // order.type === ORDER_SELL
        // they sell i buy
        if (info.bestPriceBuy === undefined || info.bestPriceBuy > order.price)
          info.bestPriceBuy = order.price;
      }
    });

    _.forEach(orders, (order) => {
      if (!order.roomName || !order.amount || order.id in Game.market.orders)
        return;
      if (order.type === ORDER_BUY) {
        // they buy i sell
        if (info.bestPriceSell !== undefined) {
          const deviation = Math.min(
            MAX_DEVIATION_PRICE,
            info.bestPriceSell * MAX_DEVIATION_PERCENT
          );
          if (order.price >= info.bestPriceSell - deviation)
            info.goodSell.push(order as ProtoOrder);
        }
      } else {
        // they sell i buy
        if (info.bestPriceBuy) {
          const deviation = Math.min(
            MAX_DEVIATION_PRICE,
            info.bestPriceBuy * MAX_DEVIATION_PERCENT
          );
          if (order.price <= info.bestPriceBuy + deviation)
            info.goodBuy.push(order as ProtoOrder);
        }
      }
    });

    return info;
  }

  private weightedAvgPrice(res: ResourceConstant, lastNDays = 10) {
    let volume = 0;
    let sumPriceWeighted = 0;
    const transactions = Game.market.getHistory(res).slice(-lastNDays);
    for (let i = 0; i < transactions.length; ++i) {
      const volumeWeighted = transactions[i].volume * (i / transactions.length);
      sumPriceWeighted += transactions[i].avgPrice * volumeWeighted;
      volume += volumeWeighted;
    }
    return volume ? sumPriceWeighted / volume : Infinity;
  }

  private checkIfLabProfitable(compound: ReactionConstant) {
    const shoppingList = compound.split("");
    let costToProduce = 0;
    let resource;
    for (let i = 0; i < shoppingList.length; ++i) {
      if (shoppingList[i] !== "2") resource = shoppingList[i];
      else resource = shoppingList[i - 1];
      this.updateRes(resource as ReactionConstant, 100);
      costToProduce += this.info[resource as ReactionConstant]!.avgPrice;
    }
    this.updateRes(compound, 100);
    // from buying materials/selling product. Not all compound need to buy in so * 0.5
    const energyCosts = this.energyPrice * (shoppingList.length + 1);
    return this.info[compound]!.avgPrice - costToProduce - energyCosts > 0;
  }

  private checkIfAnyLabProfitable() {
    this.profitableCompunds = [];
    for (const comp of Object.keys(USEFUL_MINERAL_STOCKPILE)) {
      const compound = comp as ReactionConstant;
      if (this.checkIfLabProfitable(compound))
        this.profitableCompunds.push(compound);
    }
  }

  public update() {
    this.updateRes(RESOURCE_ENERGY, MARKET_LAG * 100);

    if ((Game.time - Apiary.createTime) % 1000 === 0) {
      // later will be used to calc is it even profitable to sell something faraway
      this.energyPrice = this.weightedAvgPrice(RESOURCE_ENERGY);
      this.checkIfAnyLabProfitable();
    }

    for (const id in Game.market.orders)
      if (!Game.market.orders[id].remainingAmount) this.cancelOrder(id);

    for (const roomName in this.shortOrdersSell)
      if (Game.time > this.shortOrdersSell[roomName].lastUpdated + 20)
        this.shortOrdersSell[roomName] = { orders: {}, lastUpdated: Game.time };
  }

  public cancelOrder(orderId: string) {
    if (Apiary.logger) {
      const order = Game.market.getOrderById(orderId);
      if (order) Apiary.logger.marketLong(order);
    }
    return Game.market.cancelOrder(orderId);
  }

  public getTargetLongOrders(roomName: string) {
    const orders = _.filter(Game.market.orders, (o) => o.roomName === roomName);
    const ans: { [key in ResourceConstant]?: number } = {};
    _.forEach(orders, (o) => {
      if (o.type === ORDER_BUY || !o.remainingAmount || !o.roomName) return;
      const res = o.resourceType as ResourceConstant;
      if (!ans[res]) ans[res] = 0;
      ans[res]! += o.remainingAmount;
    });
    for (const r in this.shortOrdersSell[roomName].orders) {
      const res = r as ResourceConstant;
      if (!ans[res]) ans[res] = 0;
      ans[res]! += this.shortOrdersSell[roomName].orders[res]!;
    }
    return ans;
  }

  public longOrders(
    roomName: string,
    res: ResourceConstant,
    type: ORDER_SELL | ORDER_BUY
  ) {
    return _.filter(
      Game.market.orders,
      (order) =>
        order.roomName === roomName &&
        order.resourceType === res &&
        order.type === type
    );
  }

  public buyIn(
    terminal: StructureTerminal,
    res: ResourceConstant,
    amount: number,
    hurry = false,
    creditsToUse?: number,
    coef = hurry ? 4 : 2,
    maxPrice = Infinity
  ): "no money" | "short" | "long" {
    const roomName = terminal.pos.roomName;
    if (creditsToUse === undefined) creditsToUse = this.creditsToUse(roomName);
    if (creditsToUse < REASONABLE_MONEY) return "no money";
    let orders;
    if (!hurry) orders = this.longOrders(roomName, res, ORDER_BUY);
    const info = this.updateRes(res, orders && orders.length ? 16 : MARKET_LAG);
    const step = ORDER_PADDING * coef;
    const price = this.priceLongBuy(res, step);
    let priceToBuyInstant = info.bestPriceBuy || Infinity;

    if (res === RESOURCE_ENERGY) priceToBuyInstant *= 2; // 1.5654; // approx transfer costs

    if (hurry || priceToBuyInstant <= price * 1.05) {
      let ans: number = ERR_NOT_ENOUGH_RESOURCES;
      if (Math.floor(creditsToUse / priceToBuyInstant))
        ans = this.buyShort(terminal, res, amount, creditsToUse, maxPrice);
      switch (ans) {
        case OK:
        case ERR_TIRED:
          return "short";
        case ERR_FULL:
        case ERR_NOT_FOUND:
          if (!hurry) return "long";
          break;
        default:
          break;
      }
    }

    if (!orders)
      // prob never
      orders = this.longOrders(roomName, res, ORDER_BUY);

    if (!orders.length && Math.floor(creditsToUse / (price * 1.05)) > 0)
      this.buyLong(
        terminal,
        res,
        amount,
        creditsToUse,
        Math.min(price, maxPrice)
      );
    else {
      const o = orders.sort((a, b) => a.created - b.created)[0];
      let newPrice;
      const priceToSellInstant = info.bestPriceSell || 0;
      if (priceToSellInstant + step >= o.price + step * 10000)
        newPrice = o.price + step * 10000;
      if (priceToSellInstant + step >= o.price + step * 1000)
        newPrice = o.price + step * 1000;
      if (priceToSellInstant + step >= o.price + step * 100)
        newPrice = o.price + step * 100;
      else if (priceToSellInstant >= o.price) newPrice = o.price + step;
      if (newPrice && newPrice <= maxPrice) {
        // ( && newPrice <= price && priceToBuyInstant >= newPrice * 1.1)
        const oldPrice = o.price;
        const ans = Game.market.changeOrderPrice(o.id, newPrice);
        const fee = (newPrice - oldPrice) * o.remainingAmount * MARKET_FEE;
        if (fee > 0 && ans === OK && Apiary.logger && newPrice > oldPrice)
          Apiary.logger.reportMarketFeeChange(
            o.id,
            o.resourceType,
            fee,
            ORDER_BUY
          );
      }
    }
    return "long";
  }

  public sellOff(
    terminal: StructureTerminal,
    res: ResourceConstant,
    amount: number,
    hurry = false,
    creditsToUse?: number,
    coef = hurry ? 4 : 2,
    minPrice = 0
  ): "no money" | "short" | "long" {
    const roomName = terminal.pos.roomName;
    if (creditsToUse === undefined) creditsToUse = this.creditsToUse(roomName);
    let orders;
    if (!hurry) orders = this.longOrders(roomName, res, ORDER_SELL);
    const info = this.updateRes(res, orders && orders.length ? 16 : MARKET_LAG);
    let priceToSellInstant = info.bestPriceSell ? info.bestPriceSell : Infinity;

    const step = ORDER_PADDING * coef;
    const price = this.priceLongSell(res, step);

    priceToSellInstant -= this.energyPrice;

    if (
      hurry ||
      priceToSellInstant >= price * 0.95 ||
      COMMODITIES_TO_SELL.includes(res as CommodityConstant)
    ) {
      const ans = this.sellShort(terminal, res, amount, minPrice);
      switch (ans) {
        case OK:
          this.shortOrdersSell[roomName].orders[res] = amount;
          this.shortOrdersSell[roomName].lastUpdated = Game.time;
          return "short";
        case ERR_TIRED:
          return "short";
        case ERR_NOT_FOUND:
        case ERR_NOT_ENOUGH_RESOURCES:
        case ERR_FULL:
          this.shortOrdersSell[roomName].orders[res] = amount;
          this.shortOrdersSell[roomName].lastUpdated = Game.time;
          return "long";
        default:
      }
    }

    if (price === Infinity) return "long";

    if (creditsToUse < REASONABLE_MONEY) return "no money";

    if (!orders)
      // prob never
      orders = this.longOrders(roomName, res, ORDER_SELL);

    if (!orders.length)
      this.sellLong(
        terminal,
        res,
        amount,
        creditsToUse,
        Math.max(price, minPrice)
      );
    else {
      const o = orders.sort((a, b) => a.created - b.created)[0];
      let newPrice;
      const priceToBuyInstant = info.bestPriceBuy || Infinity;
      // to prevent money drain by instant price rise
      if (priceToBuyInstant - step <= o.price - step * 10000)
        newPrice = o.price - step * 10000;
      else if (priceToBuyInstant - step <= o.price - step * 1000)
        newPrice = o.price - step * 1000;
      else if (priceToBuyInstant - step <= o.price - step * 100)
        newPrice = o.price - step * 100;
      else if (priceToBuyInstant <= o.price) newPrice = o.price - step;
      if (newPrice && newPrice >= minPrice) {
        // && newPrice >= price && priceToSellInstant <= newPrice * 0.9)
        const oldPrice = o.price;
        const ans = Game.market.changeOrderPrice(o.id, newPrice);
        const fee = (newPrice - oldPrice) * o.remainingAmount * MARKET_FEE;
        if (fee > 0 && ans === OK && Apiary.logger && newPrice > oldPrice)
          Apiary.logger.reportMarketFeeChange(
            o.id,
            o.resourceType,
            fee,
            ORDER_SELL
          );
      }
    }
    return "long";
  }

  public creditsToUse(_: string) {
    return Game.market.credits - Memory.settings.minBalance;
  }

  // i buy as long
  public priceLongBuy(res: ResourceConstant, step: number) {
    const info = this.updateRes(res, MARKET_LAG * 100);
    return info.bestPriceSell || 0 + step / 2;
  }

  // i sell as long
  public priceLongSell(res: ResourceConstant, step: number) {
    const info = this.updateRes(res, MARKET_LAG * 100);
    return (
      (info.bestPriceBuy || (info.bestPriceSell || Infinity) * 1.3) - step / 2
    );
  }

  public buyLong(
    terminal: StructureTerminal,
    res: ResourceConstant,
    amount: number,
    creditsToUse: number,
    price: number
  ) {
    this.updateRes(res, MARKET_LAG);
    const roomName = terminal.pos.roomName;
    const priceCap = Math.floor(creditsToUse / (price * 1.05));
    amount = Math.min(amount, priceCap);
    if (!amount) return ERR_NOT_ENOUGH_RESOURCES;
    const ans = Game.market.createOrder({
      type: ORDER_BUY,
      resourceType: res,
      totalAmount: amount,
      price,
      roomName,
    });
    if (ans === OK && Apiary.logger)
      Apiary.logger.reportMarketCreation(
        res,
        amount * price * MARKET_FEE,
        ORDER_BUY
      );
    return ans;
  }

  public sellLong(
    terminal: StructureTerminal,
    res: ResourceConstant,
    amount: number,
    creditsToUse: number,
    price: number
  ) {
    this.updateRes(res, MARKET_LAG);
    const roomName = terminal.pos.roomName;
    const priceCap = Math.floor(creditsToUse / (price * MARKET_FEE));
    amount = Math.min(amount, priceCap);
    if (!amount) return ERR_NOT_ENOUGH_RESOURCES;
    const ans = Game.market.createOrder({
      type: ORDER_SELL,
      resourceType: res,
      totalAmount: amount,
      price,
      roomName,
    });
    if (ans === OK && Apiary.logger)
      Apiary.logger.reportMarketCreation(
        res,
        amount * price * MARKET_FEE,
        ORDER_SELL
      );
    return ans;
  }

  public buyShort(
    terminal: StructureTerminal,
    res: ResourceConstant,
    amount: number,
    creditsToUse: number,
    maxPrice = Infinity
  ) {
    if (terminal.cooldown) return ERR_TIRED;
    const info = this.updateRes(res, MARKET_LAG);
    let orders = info.goodBuy;
    if (!orders) return ERR_NOT_FOUND;
    if (creditsToUse < CREDIT_THRESHOLD_SLOW)
      orders = orders.filter(
        (order) => terminal.pos.getRoomRangeTo(order.roomName, "lin") <= 30
      );
    if (res === RESOURCE_ENERGY)
      orders = orders.filter(
        (order) => terminal.pos.getRoomRangeTo(order.roomName, "lin") <= 30
      );
    if (!orders.length) return ERR_NOT_IN_RANGE;

    if (maxPrice) {
      orders = orders.filter((o) => o.price <= maxPrice);
      if (!orders.length) return ERR_NOT_FOUND;
    }

    const roomName = terminal.pos.roomName;
    const order = orders.reduce((prev, curr) =>
      curr.price > prev.price ? curr : prev
    );
    const energyCost =
      Game.market.calcTransactionCost(10000, roomName, order.roomName) / 10000;
    const energyCap = Math.floor(
      terminal.store.getUsedCapacity(RESOURCE_ENERGY) / energyCost
    );
    const priceCap = Math.floor(creditsToUse / order.price);

    amount = Math.min(
      amount,
      energyCap,
      order.amount,
      priceCap,
      terminal.store.getFreeCapacity(res)
    );
    if (!amount) return ERR_NOT_ENOUGH_RESOURCES;

    const ans = Game.market.deal(order.id, amount, roomName);
    if (ans === OK && Apiary.logger)
      Apiary.logger.marketShort(order, amount, roomName);
    return ans;
  }

  public sellShort(
    terminal: StructureTerminal,
    res: ResourceConstant,
    amount: number,
    minPrice = 0
  ) {
    if (terminal.cooldown) return ERR_TIRED;
    const info = this.updateRes(res, MARKET_LAG);
    let orders = info.goodSell;
    if (!orders) return ERR_NOT_FOUND;
    // if (!_.filter(COMPRESS_MAP, r => r === res).length)
    // orders = orders.filter(order => terminal.pos.getRoomRangeTo(order.roomName) <= 50)
    if (!orders.length) return ERR_NOT_IN_RANGE;

    if (minPrice) {
      orders = orders.filter((o) => o.price >= minPrice);
      if (!orders.length) return ERR_NOT_FOUND;
    }

    const roomName = terminal.pos.roomName;
    const calcEnergyCost = (o: ProtoOrder) =>
      (this.energyPrice *
        Game.market.calcTransactionCost(10000, roomName, o.roomName)) /
      10000;
    const order = orders.reduce((prev, curr) =>
      curr.price + calcEnergyCost(curr) < prev.price + calcEnergyCost(prev)
        ? curr
        : prev
    );

    const energyCost =
      Game.market.calcTransactionCost(10000, roomName, order.roomName) / 10000;
    const energyCap = Math.floor(
      terminal.store.getUsedCapacity(RESOURCE_ENERGY) / energyCost
    );
    amount = Math.min(
      amount,
      energyCap,
      order.amount,
      terminal.store.getUsedCapacity(res)
    );

    if (
      res === RESOURCE_ENERGY &&
      amount * (1 + energyCost) >
        terminal.store.getUsedCapacity(RESOURCE_ENERGY)
    )
      amount = Math.floor(amount * (1 - energyCost));

    if (!amount) return ERR_NOT_ENOUGH_RESOURCES;

    const ans = Game.market.deal(order.id, amount, roomName);
    if (ans === OK && Apiary.logger)
      Apiary.logger.marketShort(order, amount, roomName);
    return ans;
  }
}
