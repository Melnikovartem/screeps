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

  // next 2 are for hand usage
  fillTerminal(roomName: string, resource: ResourceConstant, amount?: number): string {
    if (!(roomName in this.hives))
      return "ERROR: HIVE NOT FOUND";
    let storageCell = this.hives[roomName].cells.storage
    if (!storageCell)
      return "ERROR: STORAGE NOT FOUND";
    if (!storageCell.terminal)
      return "ERROR: TERMINAL NOT FOUND";
    amount = Math.min(amount ? amount : 100000, storageCell.storage.store[resource]);
    storageCell.requests["!USER_REQUEST " + makeId(4)] = ({
      from: [storageCell.storage],
      to: [storageCell.terminal],
      resource: resource,
      amount: amount,
      priority: 2,
    });
    return `OK \nRESOURCE ${resource}: ${amount}`;
  }

  emptyTerminal(roomName: string, resource: ResourceConstant, amount?: number) {
    if (!(roomName in this.hives))
      return "ERROR: HIVE NOT FOUND";
    let storageCell = this.hives[roomName].cells.storage
    if (!storageCell)
      return "ERROR: STORAGE NOT FOUND";
    if (!storageCell.terminal)
      return "ERROR: TERMINAL NOT FOUND";
    amount = Math.min(amount ? amount : 100000, storageCell.terminal.store[resource]);
    storageCell.requests["!USER_REQUEST " + makeId(4)] = ({
      from: [storageCell.terminal],
      to: [storageCell.storage],
      resource: resource,
      amount: amount,
      priority: 2,
    });
    return `OK \nRESOURCE ${resource}: ${amount}`;
  }

  completeOrder(roomName: string, orderId: string, amount?: number) {
    if (!(roomName in this.hives))
      return "ERROR: HIVE NOT FOUND";
    let storageCell = this.hives[roomName].cells.storage
    if (!storageCell)
      return "ERROR: STORAGE NOT FOUND";
    if (!storageCell.terminal)
      return "ERROR: TERMINAL NOT FOUND";
    if (storageCell.terminal.cooldown)
      return "TERMINAL COOLDOWN";
    let order = Game.market.getOrderById(orderId);
    if (!order)
      return "ORDER NOT FOUND";
    if (!order.roomName)
      return "THIS FUNCTION FOR ROOM TO ROOM TRADE";
    amount = amount ? amount : order.remainingAmount;
    let resource = <ResourceConstant>order.resourceType
    if (resource && order.type == ORDER_BUY)
      amount = Math.min(amount, storageCell.terminal.store[resource]);
    let ans = Game.market.deal(orderId, amount, roomName);
    if (ans == OK)
      return `OK ${order.type == ORDER_SELL ? "BOUGHT" : "SOLD"}\nRESOURCE ${order.resourceType}: ${amount}\nMONEY: ${amount * order.price}\nENERGY: ${Game.market.calcTransactionCost(amount, roomName, order.roomName)}`;
    else if (ans == ERR_NOT_ENOUGH_RESOURCES)
      return `NOT ENOUGHT RESOURSES\nRESOURCE ${order.resourceType}: ${amount}\nMONEY: ${amount * order.price}\nENERGY: ${Game.market.calcTransactionCost(amount, roomName, order.roomName)}`;
    else if (ans == ERR_INVALID_ARGS)
      return `orderId: ${orderId}\n amount: ${amount}\n roomName: ${roomName}`;
    return ans;
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

  checkFlag(flag: Flag) {
    let ref = flag.name;
    if (!this.orders[ref])
      this.orders[ref] = new Order(flag);
    else if (this.orders[ref].update(flag) == 0) { // if killsig
      flag.remove();
      delete this.orders[ref];
    }
  }

  // update phase
  update() {
    _.forEach(Game.flags, (flag) => {
      safeWrap(() => this.checkFlag(flag), "update " + flag.name)
    });

    _.forEach(this.hives, (hive) => {
      safeWrap(() => hive.update(), "update " + hive.roomName);
    });

    _.forEach(this.bees, (bee) => {
      bee.update();
    });
    this.findBees();

    _.forEach(this.masters, (master) => {
      safeWrap(() => master.update(), "update " + master.ref);
    });
  }

  // run phase
  run() {
    _.forEach(this.hives, (hive) => {
      safeWrap(() => hive.run(), "run " + hive.roomName);
    });
    _.forEach(this.masters, (master) => {
      safeWrap(() => master.run(), "run " + master.ref);
    });
  }
}
