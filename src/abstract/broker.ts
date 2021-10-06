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

@profile
export class Broker {

  // if it will become to heavy will switch to storing orderId

  // buy - i buy in resource
  goodBuy: { [key in ResourceConstant]?: ProtoOrder[] } = {};
  // see - i sell resource
  goodSell: { [key in ResourceConstant]?: ProtoOrder[] } = {};

  bestPriceBuy: { [key in ResourceConstant]?: number } = {};
  bestPriceSell: { [key in ResourceConstant]?: number } = {};

  energyPrice: number = Infinity;

  lastUpdated: number = -1;

  update() {
    // on shard2 during 10.2021 it took about 9.5CPU to calc all this
    // let cpu = Game.cpu.getUsed();
    this.lastUpdated = Game.time;
    this.goodBuy = {};
    this.goodSell = {};

    this.bestPriceBuy = {};
    this.bestPriceSell = {};

    let orders = Game.market.getAllOrders();

    _.forEach(orders, order => {
      if (!order.roomName || !order.amount)
        return;
      let res = <ResourceConstant>order.resourceType;

      if (order.type === ORDER_BUY) {
        // they buy i sell
        if (!this.bestPriceSell[res] || this.bestPriceSell[res]! < order.price)
          this.bestPriceSell[res] = order.price;
      } else { // order.type === ORDER_SELL
        // they sell i buy
        if (!this.bestPriceBuy[res] || this.bestPriceBuy[res]! > order.price)
          this.bestPriceBuy[res] = order.price;
      }
    });

    _.forEach(orders, order => {
      if (!order.roomName || !order.amount)
        return;
      let res = <ResourceConstant>order.resourceType;
      let deviation = Math.min(MAX_DEVIATION_PRICE, this.bestPriceSell[res]! * MAX_DEVIATION_PERCENT);

      if (order.type === ORDER_BUY) {
        // they buy i sell
        if (order.price >= this.bestPriceSell[res]! - deviation) {
          if (!this.goodSell[res])
            this.goodSell[res] = [];
          this.goodSell[res]!.push(<ProtoOrder>order);
        }
      } else {
        // they sell i buy
        if (order.price <= this.bestPriceBuy[res]! + deviation) {
          if (!this.goodBuy[res])
            this.goodBuy[res] = [];
          this.goodBuy[res]!.push(<ProtoOrder>order);
        }
      }
    });

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
      console.log(`${res} buy: ${this.bestPriceBuy[r]} @ ${amountBuy} sell: ${this.bestPriceSell[r]} @ ${amountSell}`)
    }
    console.log("order update\ncpu used: " + (Game.cpu.getUsed() - cpu));
    console.log(`transfer energy buyInLimit ${energyToBuy} sellOutLimit ${energyToSell}`);
    */
  }

  sellOff(terminal: StructureTerminal, res: ResourceConstant, amount: number) {
    let roomName = terminal.pos.roomName;
    let orders = this.goodSell[res];
    if (!orders)
      return ERR_NOT_FOUND;
    orders = orders.filter(order => terminal.pos.getRoomRangeTo(order.roomName))
    if (!orders.length)
      return ERR_NOT_FOUND;

    let order = orders.reduce((prev, curr) => curr.price > prev.price ? curr : prev);
    let energyCost = Game.market.calcTransactionCost(10000, roomName, order.roomName!) / 10000;
    let energyCap = Math.floor(terminal.store.getUsedCapacity(RESOURCE_ENERGY) / energyCost);
    amount = Math.min(amount, energyCap, order.amount);

    if (orders[0].resourceType === RESOURCE_ENERGY && amount * (1 + energyCost) > terminal.store.getUsedCapacity(RESOURCE_ENERGY))
      amount = Math.floor(amount * (1 - energyCost));

    let ans = Game.market.deal(orders[0].id, amount, roomName);
    if (ans === OK) {
      if (Apiary.logger)
        Apiary.logger.newMarketOperation(order, amount, roomName);
      return amount;
    }

    return 0;
  }
}
