import { Hive } from "./Hive";
import { Bee } from "./bee";

import { Intel } from "./intelligence";
import { Order } from "./order";
import { makeId } from "./utils/other";

import { PRINT_INFO } from "./settings";
import { profile } from "./profiler/decorator";

@profile
export class _Apiary {
  hives: { [id: string]: Hive } = {};
  destroyTime: number;

  orders: { [id: string]: Order } = {};

  intel: Intel;

  constructor() {
    this.destroyTime = Game.time + 4000;

    if (PRINT_INFO) console.log(Game.time, "creating new apiary");

    global.bees = {};
    global.masters = {};

    this.intel = new Intel();

    let myRoomsAnnexes: { [id: string]: string[] } = {};

    _.forEach(Game.rooms, (room) => {
      if (room.controller && room.controller.my)
        myRoomsAnnexes[room.name] = [];
    });

    _.forEach(Game.flags, (flag) => {
      // annex room
      if (flag.color == COLOR_PURPLE && flag.secondaryColor == COLOR_PURPLE) {
        _.some(Game.map.describeExits(flag.pos.roomName), (exit) => {
          if (exit && myRoomsAnnexes[exit] && !myRoomsAnnexes[exit].includes(flag.pos.roomName)) {
            myRoomsAnnexes[exit].push(flag.pos.roomName);
            return true;
          }
          return false;
        });
      }
    });

    _.forEach(myRoomsAnnexes, (annexNames, roomName) => {
      if (roomName)
        this.hives[roomName] = new Hive(roomName, annexNames);
    });
  }

  // next 2 are for hand usage
  fillTerminal(roomName: string, resource: ResourceConstant, amount?: number): string {
    if (!(roomName in this.hives))
      return "ERROR: HIVE NOT FOUND";
    let storageCell = this.hives[roomName].cells.storageCell
    if (!storageCell)
      return "ERROR: STORAGE NOT FOUND";
    if (!storageCell.terminal)
      return "ERROR: TERMINAL NOT FOUND";
    storageCell.requests["!USER_REQUEST " + makeId(4)] = ({
      from: storageCell.storage,
      to: storageCell.terminal,
      resource: resource,
      amount: amount ? amount : Math.min(100000, storageCell.storage.store[resource]),
      priority: 2,
    });
    return "OK";
  }

  emptyTerminal(roomName: string, resource: ResourceConstant, amount?: number) {
    if (!(roomName in this.hives))
      return "ERROR: HIVE NOT FOUND";
    let storageCell = this.hives[roomName].cells.storageCell
    if (!storageCell)
      return "ERROR: STORAGE NOT FOUND";
    if (!storageCell.terminal)
      return "ERROR: TERMINAL NOT FOUND";
    storageCell.requests["!USER_REQUEST " + makeId(4)] = ({
      from: storageCell.terminal,
      to: storageCell.storage,
      resource: resource,
      amount: amount ? amount : Math.min(100000, storageCell.storage.store[resource]),
      priority: 2,
    });
    return "OK";
  }

  sellOrder(roomName: string, resource: ResourceConstant, amount?: number) {
    if (!(roomName in this.hives))
      return "ERROR: HIVE NOT FOUND";
    let storageCell = this.hives[roomName].cells.storageCell
    if (!storageCell)
      return "ERROR: STORAGE NOT FOUND";
    if (!storageCell.terminal)
      return "ERROR: TERMINAL NOT FOUND";
    storageCell.requests["!USER_REQUEST " + makeId(4)] = ({
      from: storageCell.terminal,
      to: storageCell.storage,
      resource: resource,
      amount: amount ? amount : Math.min(100000, storageCell.storage.store[resource]),
      priority: 2,
    });
    return "OK";
  }

  findBees() {
    // after all the masters where created and retrived if it was needed
    for (const name in Memory.creeps) {
      if (!global.bees[name]) {
        let creep = Game.creeps[name];
        if (global.masters[creep.memory.refMaster]) {
          // not sure if i rly need a global bees hash
          global.bees[creep.name] = new Bee(creep);
          global.masters[creep.memory.refMaster].newBee(global.bees[creep.name]);
        } else if (creep.memory.refMaster.includes("masterDevelopmentCell_")) {
          // TODO think of something smart
          let randomMaster = Object.keys(global.masters)[Math.floor(Math.random() * Object.keys(global.masters).length)];
          creep.memory.refMaster = randomMaster;

          global.bees[creep.name] = new Bee(creep);
          global.masters[creep.memory.refMaster].newBee(global.bees[creep.name]);
        }
        // idk what to do if i lost a master to the bee. I guess the bee is just FUCKED for now
      }
    }
  }

  updateFlags() {
    _.forEach(Game.flags, (flag) => {
      if (flag.color == COLOR_RED || flag.color == COLOR_ORANGE) {
        let ref = flag.name
        if (!this.orders[ref])
          this.orders[ref] = new Order(flag);
        else if (this.orders[ref].update(flag) == 0) { // if killsig
          flag.remove();
          delete this.orders[ref];
        }
      }
    });
  }

  // update phase
  update() {
    _.forEach(this.hives, (hive) => {
      hive.update();
    });

    this.updateFlags();

    _.forEach(global.bees, (bee) => {
      bee.update();
    });
    this.findBees();

    _.forEach(global.masters, (master) => {
      master.update();
    });
  }

  // run phase
  run() {
    _.forEach(this.hives, (hive) => {
      hive.run();
    });
    _.forEach(global.masters, (master) => {
      master.run();
    });
  }
}
