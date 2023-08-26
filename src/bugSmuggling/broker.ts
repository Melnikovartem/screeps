import {
  ReactionConstant,
  USEFUL_MINERAL_STOCKPILE,
} from "cells/stage1/laboratoryCell";

import { COMMODITIES_TO_SELL } from "../cells/stage1/factoryCell";
import { profile } from "../profiler/decorator";

// @MARKETDANGER tag for strange/custom coefs bases on data from summer 2023

// Define the structure of a proto order for market transactions
export interface ProtoOrder {
  id: string;
  roomName: string;
  price: number;
  amount: number;
  resourceType: ResourceConstant;
  type: ORDER_BUY | ORDER_SELL;
}

// Constants for controlling market behavior
const MAX_DEVIATION_PERCENT = 0.1;
const MAX_DEVIATION_PRICE = 10;

const ORDER_OFFSET = 0.001;
const MARKET_FEE = 0.05;

// @MARKETDANGER
const SKIP_SMALL_ORDER = 500;
const MARKET_SETTINGS = {
  pocketChange: 100, // i do not care if i lose this amount on an order
  okLossAmount: 10000, // i can pay this price to smooth things
  reserveCredits: 1_000_000, // Maintain balance above this amount
  mineralCredits: 5_000_000, // Buy credits if above this amount
  boostCredits: 10_000_000, // Buy boosts directly if above this amount
  energyCredits: 50_000_000, // Buy energy if above this amount
  orders: {
    timeout: 1_000_000, // Remove orders after this many ticks if remaining amount < cleanupAmount
    cleanupAmount: 10, // RemainingAmount threshold to remove expiring orders
  },
};
export const MARKET_LAG = Game.cpu.limit <= 20 ? 40 : 10;

/* 
  Define the structure to store price statistics for different resources.
  This will help keep track of good buy and sell orders for each resource.
*/
type PriceStat = { [key in ResourceConstant]?: number };

@profile
export class Broker {
  /**
   * List of profitable compounds for reactions
   * @param profitableCompounds - List of ReactionConstant values representing profitable compounds.
   */
  public profitableCompounds: ReactionConstant[] = [];

  /**
   * Information about resource orders and prices
   * @param info - Object storing information about different resources' orders and prices.
   */
  private info: {
    [key in ResourceConstant]?: {
      /** buy - i buy in resource */
      goodBuy: ProtoOrder[];
      /** sell - i sell resource */
      goodSell: ProtoOrder[];
      /** best Market Price to Buy | they sell i buy instant */
      bestPriceBuy?: number;
      /** best Market Price to Sell | they buy i sell instant */
      bestPriceSell?: number;
      /** Weighted avg/high/low price of past 10 days
       *
       * VERY!! unrelaible way to access price */
      avgPrice: number;
      /** Last time metric was updated */
      lastUpdated: number;
    };
  } = {};

  /**
   * Short-term sell orders for resources
   * Stored to move resources in terminal and exec order
   * @param shortOrdersSell - Object storing short-term sell orders for different room names.
   */
  public shortOrdersSell: {
    [roomName: string]: { orders: PriceStat; lastUpdated: number };
  } = {};

  /**
   * Energy price in the market
   * @param energyPrice - Current energy price in the market.
   */
  private energyPrice: number = Infinity;

  /**
   * Function to update resource information and orders
   * @param res - ResourceConstant for which to update information.
   * @param lag - Lag parameter for updating information.
   * @returns Updated resource information.
   */
  private updateRes(res: ResourceConstant, lag: number = MARKET_LAG) {
    let info = this.info[res]!;
    if (info && info.lastUpdated + lag >= Game.time) return info;

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
      if (
        !order.roomName ||
        order.amount <= SKIP_SMALL_ORDER ||
        order.id in Game.market.orders
      )
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

  /**
   * Function to get the average price of a resource
   * @param res - ResourceConstant for which to get the average price.
   * @returns Average price of the specified resource.
   */
  public avgPrice(res: ResourceConstant) {
    this.updateRes(res, 1000);
    return this.info[res]!.avgPrice;
  }

  /**
   * Calculate the weighted average price of a resource
   * @param res - ResourceConstant for which to calculate the weighted average price.
   * @param lastNDays - Number of days to consider for weighted average calculation.
   * @returns Weighted average price of the specified resource.
   */
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

  /**
   * Check if a lab-produced compound is profitable
   * @param compound - ReactionConstant representing the compound to check.
   * @returns Whether the compound is profitable to produce.
   */
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
    // from buying materials/selling product. Not all compound need to buy in so * 0.8
    // not always paying 1 energy so * 0.9
    // 0.8 * 0.9 = 0.72 ~ 0.7
    // @MARKETDANGER
    const energyCosts = this.energyPrice * (shoppingList.length + 1) * 0.7;
    return this.info[compound]!.avgPrice - costToProduce - energyCosts > 0;
  }

  /**
   * Check if any lab-produced compounds are profitable
   */
  private checkIfAnyLabProfitable() {
    this.profitableCompounds = [];
    for (const comp of Object.keys(USEFUL_MINERAL_STOCKPILE)) {
      const compound = comp as ReactionConstant;
      if (this.checkIfLabProfitable(compound))
        this.profitableCompounds.push(compound);
    }
  }

  /**
   * Update market-related information
   */
  public update() {
    this.updateRes(RESOURCE_ENERGY, MARKET_LAG * 100);

    if ((Game.time - Apiary.createTime) % 1000 === 571) {
      // later will be used to calc is it even profitable to sell something faraway
      this.energyPrice = this.weightedAvgPrice(RESOURCE_ENERGY);
      this.checkIfAnyLabProfitable();
    }

    // clean empty / old inactive small orders
    for (const [id, order] of Object.entries(Game.market.orders))
      if (
        (!order.active &&
          Game.time - order.created >= MARKET_SETTINGS.orders.timeout &&
          order.remainingAmount < MARKET_SETTINGS.orders.cleanupAmount) ||
        !order.remainingAmount
      )
        this.cancelOrder(id);

    // empty shortOrdersSell
    for (const roomName in this.shortOrdersSell)
      if (Game.time > this.shortOrdersSell[roomName].lastUpdated + 20)
        this.shortOrdersSell[roomName] = { orders: {}, lastUpdated: Game.time };
  }

  /**
   * Cancel a market order
   * @param orderId - ID of the market order to cancel.
   * @returns Result of the order cancellation.
   */
  public cancelOrder(orderId: string) {
    if (Apiary.logger) {
      const order = Game.market.getOrderById(orderId);
      if (order) Apiary.logger.marketLong(order);
    }
    return Game.market.cancelOrder(orderId);
  }

  /**
   * Get target long orders for a room
   * @param roomName - Name of the room for which to get target long orders.
   * @returns Object containing target long orders for different resources.
   */
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

  /**
   * Get long orders for a specific resource and order type
   */
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

  /** Main smart function to buy stuff */
  public buyIn(
    terminal: StructureTerminal,
    res: ResourceConstant,
    amount: number,
    tryFaster: boolean = false
  ): "no money" | "short" | "long" {
    const roomName = terminal.pos.roomName;
    const hive = Apiary.hives[roomName];
    if (!hive) return "no money"; // safecheck
    const creditsToUse = this.creditsToUse();
    if (creditsToUse < MARKET_SETTINGS.reserveCredits) return "no money";

    let hurry;
    const speedUpBuy = hive.resState[res] || 0 <= 0;
    if (tryFaster) hurry = speedUpBuy ? "RightNow" : "GoodPrice";
    else hurry = speedUpBuy ? "AnyBuck" : "RightNow";

    let okLoss = 0;
    switch (hurry) {
      case "GoodPrice":
        break;
      case "RightNow":
        okLoss = MARKET_SETTINGS.pocketChange;
        break;
      case "AnyBuck":
        okLoss = MARKET_SETTINGS.okLossAmount;
        break;
    }

    const info = this.updateRes(res, MARKET_LAG);
    const priceToBuyLong = info.bestPriceSell || info.avgPrice;
    const priceToBuyInstant = info.bestPriceBuy || info.avgPrice;

    if (
      Math.floor(
        creditsToUse / Math.min(priceToBuyInstant, priceToBuyLong * 1.05)
      ) < 0
    )
      return "no money";

    const loss =
      (priceToBuyInstant +
        this.energyPrice * 0.7 -
        priceToBuyLong * (1 + MARKET_FEE)) *
      amount;

    if (loss < okLoss) {
      const ans = this.buyShort(
        terminal,
        res,
        amount,
        priceToBuyInstant + okLoss
      );
      switch (ans) {
        case OK:
        case ERR_TIRED:
          return "short"; // tried to buy short
        case ERR_FULL:
        case ERR_NOT_FOUND:
          return "long"; // do not force it
        default:
          break;
      }
    }

    const orders = this.longOrders(roomName, res, ORDER_BUY);
    let myPrice = priceToBuyLong + ORDER_OFFSET;
    if (!orders.length) this.buyLong(terminal, res, amount, myPrice);
    else {
      const myOrder = orders.sort((a, b) => a.created - b.created)[0];

      const diffInPrice = myPrice - myOrder.price;
      const coefForStep = hurry === "GoodPrice" ? 0.02 : 0.08;
      myPrice = myOrder.price + diffInPrice * coefForStep; // trying to get to myPrice but not too fast

      const ans = Game.market.changeOrderPrice(myOrder.id, myPrice);

      // report stuff
      const fee =
        (myPrice - myOrder.price) * myOrder.remainingAmount * MARKET_FEE;
      if (fee > 0 && ans === OK && Apiary.logger)
        Apiary.logger.reportMarketFeeChange(
          myOrder.id,
          myOrder.resourceType,
          fee,
          ORDER_BUY
        );
    }
    return "long";
  }

  /** Main smart function to sell stuff */
  public sellOff(
    terminal: StructureTerminal,
    res: ResourceConstant,
    amount: number,
    tryFaster: boolean = false
  ): "no money" | "short" | "long" {
    const roomName = terminal.pos.roomName;
    const hive = Apiary.hives[roomName];
    if (!hive) return "no money"; // safecheck
    const creditsToUse = this.creditsToUse();

    let hurry;
    const speedUpBuy =
      (hive.resState[res] || 0) > (hive.resState[res] || 0) + 1000;
    if (tryFaster) hurry = speedUpBuy ? "RightNow" : "GoodPrice";
    else hurry = speedUpBuy ? "AnyBuck" : "RightNow";

    let okLoss = 0;
    switch (hurry) {
      case "GoodPrice":
        break;
      case "RightNow":
        okLoss = MARKET_SETTINGS.pocketChange;
        break;
      case "AnyBuck":
        okLoss = MARKET_SETTINGS.okLossAmount;
        break;
    }

    const info = this.updateRes(res, MARKET_LAG);
    const priceToSellLong = info.bestPriceBuy || info.avgPrice;
    const priceToSellInstant = info.bestPriceSell || info.avgPrice;

    const loss =
      (priceToSellInstant +
        this.energyPrice * 0.7 -
        priceToSellLong * (1 + MARKET_FEE)) *
      amount;
    const okToShortSell =
      loss < okLoss ||
      COMMODITIES_TO_SELL.includes(res as CommodityConstant) ||
      creditsToUse < MARKET_SETTINGS.reserveCredits;

    if (okToShortSell) {
      const ans = this.sellShort(
        terminal,
        res,
        amount,
        priceToSellInstant - okLoss
      );
      switch (ans) {
        case OK:
          // move reosources to terminal
          this.shortOrdersSell[roomName].orders[res] = amount;
          this.shortOrdersSell[roomName].lastUpdated = Game.time;
          return "short";
        case ERR_TIRED:
          return "short";
        case ERR_NOT_FOUND:
        case ERR_NOT_ENOUGH_RESOURCES:
        case ERR_FULL:
          // move reosources to terminal
          this.shortOrdersSell[roomName].orders[res] = amount;
          this.shortOrdersSell[roomName].lastUpdated = Game.time;
          return "long";
        default:
      }
    }

    const orders = this.longOrders(roomName, res, ORDER_SELL);
    let myPrice = priceToSellLong - ORDER_OFFSET;
    if (!orders.length) this.sellLong(terminal, res, amount, myPrice);
    else {
      const myOrder = orders.sort((a, b) => a.created - b.created)[0];

      const diffInPrice = myPrice - myOrder.price;
      const coefForStep = hurry === "GoodPrice" ? 0.02 : 0.08;
      myPrice = myOrder.price + diffInPrice * coefForStep; // trying to get to myPrice but not too fast

      const ans = Game.market.changeOrderPrice(myOrder.id, myPrice);

      // report stuff
      const fee =
        (myPrice - myOrder.price) * myOrder.remainingAmount * MARKET_FEE;
      if (fee > 0 && ans === OK && Apiary.logger)
        Apiary.logger.reportMarketFeeChange(
          myOrder.id,
          myOrder.resourceType,
          fee,
          ORDER_SELL
        );
    }
    return "long";
  }

  /**
   * Buy resources through a long order
   *
   * @param {StructureTerminal} terminal - The terminal structure in the room
   * @param {ResourceConstant} res - The resource constant to buy
   * @param {number} amount - The amount of resources to buy
   * @param {number} price - The price at which to buy the resources
   * @returns {number} - Result code indicating the success of the operation
   */
  public buyLong(
    terminal: StructureTerminal,
    res: ResourceConstant,
    amount: number,
    price: number
  ) {
    const roomName = terminal.pos.roomName;
    const priceCap = Math.floor(this.creditsToUse() / (price * 1.05));
    amount = Math.min(amount, priceCap);
    if (!amount) return ERR_NOT_ENOUGH_RESOURCES;
    const ans = Game.market.createOrder({
      type: ORDER_BUY,
      resourceType: res,
      price,
      totalAmount: amount,
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

  /**
   * Sell resources through a long order
   *
   * @param {StructureTerminal} terminal - The terminal structure in the room
   * @param {ResourceConstant} res - The resource constant to sell
   * @param {number} amount - The amount of resources to sell
   * @param {number} price - The price at which to sell the resources
   * @returns {number} - Result code indicating the success of the operation
   */
  public sellLong(
    terminal: StructureTerminal,
    res: ResourceConstant,
    amount: number,
    price: number
  ) {
    const roomName = terminal.pos.roomName;
    const priceCap = Math.floor(this.creditsToUse() / (price * MARKET_FEE));
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

  /**
   * Buy resources through a short order
   */
  public buyShort(
    terminal: StructureTerminal,
    res: ResourceConstant,
    amount: number,
    okPrice: number
  ) {
    if (terminal.cooldown) return ERR_TIRED;
    const roomName = terminal.pos.roomName;
    const hive = Apiary.hives[roomName];
    if (!hive) return; // failsafe

    const info = this.updateRes(res, MARKET_LAG);
    let orders = info.goodBuy;
    if (!orders.length) return ERR_NOT_FOUND;
    if (hive.resState[RESOURCE_ENERGY] < 0)
      orders = orders.filter(
        (orderIt) => terminal.pos.getRoomRangeTo(orderIt.roomName, "lin") <= 30
      );
    if (!orders.length) return ERR_NOT_IN_RANGE;

    orders = orders.filter((o) => o.price <= okPrice);
    if (!orders.length) return ERR_NOT_FOUND;
    // @MARKETDANGER energy coef not stable
    const calcCostWithEnergy = (o: ProtoOrder) =>
      o.price +
      this.energyPrice *
        Game.market.calcTransactionCost(amount, roomName, o.roomName) *
        0.5;
    const order = orders.reduce((prev, curr) =>
      calcCostWithEnergy(curr) > calcCostWithEnergy(prev) ? curr : prev
    );
    const energyCost =
      Game.market.calcTransactionCost(10000, roomName, order.roomName) / 10000;
    const energyCap = Math.floor(
      terminal.store.getUsedCapacity(RESOURCE_ENERGY) / energyCost
    );
    const priceCap = Math.floor(this.creditsToUse() / order.price);

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

  /**
   * Sell resources through a short order
   */
  public sellShort(
    terminal: StructureTerminal,
    res: ResourceConstant,
    amount: number,
    okPrice: number
  ) {
    if (terminal.cooldown) return ERR_TIRED;
    const roomName = terminal.pos.roomName;
    const hive = Apiary.hives[roomName];
    if (!hive) return; // failsafe

    const info = this.updateRes(res, MARKET_LAG);
    let orders = info.goodSell;
    if (!orders.length) return ERR_NOT_FOUND;
    if (hive.resState[RESOURCE_ENERGY] < 0)
      orders = orders.filter(
        (orderIt) => terminal.pos.getRoomRangeTo(orderIt.roomName, "lin") <= 30
      );
    if (!orders.length) return ERR_NOT_IN_RANGE;

    orders = orders.filter((o) => o.price >= okPrice);
    if (!orders.length) return ERR_NOT_FOUND;

    const calcCostWithEnergy = (o: ProtoOrder) =>
      o.price +
      this.energyPrice *
        Game.market.calcTransactionCost(amount, roomName, o.roomName) *
        0.5;
    const order = orders.reduce((prev, curr) =>
      calcCostWithEnergy(curr) < calcCostWithEnergy(prev) ? curr : prev
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

  /**
   * Function to determine the price that i am ready to pay for a long buy order
   *
   * @param {ResourceConstant} res - The resource constant for which to calculate the price
   * @param {number} step - The step value for price calculation
   * @returns {number} - The calculated buy order price
   */
  public priceLongBuy(res: ResourceConstant, step: number) {
    const info = this.updateRes(res, MARKET_LAG * 100);
    return info.bestPriceSell || 0 + step / 2;
  }

  /**
   * Function to determine the price that i am ready to pay for a long sell order
   *
   * @param {ResourceConstant} res - The resource constant for which to calculate the price
   * @param {number} step - The step value for price calculation
   * @returns {number} - The calculated sell order price
   */
  public priceLongSell(res: ResourceConstant, step: number) {
    const info = this.updateRes(res, MARKET_LAG * 100);
    return (
      (info.bestPriceBuy || (info.bestPriceSell || Infinity) * 1.3) - step / 2
    );
  }

  /**
   * Calculate the credits available for use in market transactions
   *
   * @returns {number} - The available credits for market transactions
   */
  private creditsToUse() {
    return Game.market.credits;
  }
}
