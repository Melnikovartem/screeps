import { Hive } from "../hive";

import { profile } from "../profiler/decorator";
import { LOGGING_CYCLE } from "../settings";

@profile
export class Logger {
  constructor() {
    Memory.log.apiary = Game.time;
  }

  static init(force: boolean = false) {
    if (force || !Memory.log)
      Memory.log = {
        reset: -1,
        apiary: -1,
        hives: {}, orders: {},
        crashes: {}, enemies: {}
      };
  }

  initHive(hiveName: string) {
    if (!Memory.log.hives[hiveName])
      Memory.log.hives[hiveName] = {
        loggedStates: {},
        spawns: {},
        resourceBalance: { [RESOURCE_ENERGY]: {} }
      }
  }

  addResourceStat(hiveName: string, ref: string, amount: number, resource: ResourceConstant = RESOURCE_ENERGY) {
    if (!Memory.log.hives[hiveName])
      return ERR_NOT_FOUND;
    if (!Memory.log.hives[hiveName].resourceBalance[resource])
      Memory.log.hives[hiveName].resourceBalance[resource] = {};
    if (!Memory.log.hives[hiveName].resourceBalance[resource]![ref])
      Memory.log.hives[hiveName].resourceBalance[resource]![ref] = {
        amount: 0,
        time: Game.time,
      }

    Memory.log.hives[hiveName].resourceBalance[resource]![ref].amount += amount;
    return OK;
  }

  resourceTransfer<R extends ResourceConstant>(hiveName: string, ref: string, storeFrom: Store<R, false>,
    storeTo: Store<R, false>, resource: R = <R>RESOURCE_ENERGY, mode: 1 | -1 = -1) {
    if (!Memory.log.hives[hiveName])
      return ERR_NOT_FOUND;
    let amount = Math.min(<number>storeFrom.getUsedCapacity(resource), <number>storeTo.getFreeCapacity(resource)) * mode;
    this.addResourceStat(hiveName, ref, amount, resource);
    return OK;
  }

  newSpawn(beeName: string, spawn: StructureSpawn, cost: number, priority: number, masterName: string) {
    if (!Memory.log.hives[spawn.pos.roomName])
      return ERR_NOT_FOUND;
    Memory.log.hives[spawn.pos.roomName].spawns[beeName] = {
      time: Game.time,
      fromSpawn: spawn.name,
      orderedBy: masterName,
      priority: priority,
    };

    this.addResourceStat(spawn.pos.roomName, "spawn_" + beeName.substring(0, beeName.length - 5), cost);
    return OK;
  }

  hiveLog(hive: Hive) {
    if (!Memory.log.hives[hive.roomName])
      return ERR_NOT_FOUND;
    if (Game.time % LOGGING_CYCLE == 0) {
      let orderMap: { [id: string]: { amount: number, priority: number } } = {};

      for (const ref in hive.spawOrders) {
        orderMap[ref] = {
          amount: hive.spawOrders[ref].amount,
          priority: hive.spawOrders[ref].priority,
        };
      }

      Memory.log.hives[hive.roomName].loggedStates[Game.time] = {
        annexNames: hive.annexNames,
        constructionSites: hive.constructionSites.length,
        emergencyRepairs: hive.emergencyRepairs.length,
        normalRepairs: hive.normalRepairs.length,
        spawOrders: orderMap,
      };
      return OK;
    }
    return ERR_BUSY;
  }

  clean() {
    if (Game.time % LOGGING_CYCLE == 0) {
      for (let key in Memory.log.hives) {
        let sortedKeys: string[] = Object.keys(Memory.log.hives[key].loggedStates)
          .sort((a, b) => <number><unknown>b - <number><unknown>a);
        let j = sortedKeys.length - 10;
        _.some(sortedKeys, (i) => {
          if (--j <= 0) return true;
          delete Memory.log.hives[key].loggedStates[<number><unknown>i];
          return false;
        });

        sortedKeys = Object.keys(Memory.log.hives[key].spawns)
          .sort((a, b) => Memory.log.hives[key].spawns[b].time - Memory.log.hives[key].spawns[a].time);
        j = sortedKeys.length - 10;
        _.some(sortedKeys, (i) => {
          if (--j <= 0) return true;
          delete Memory.log.hives[key].spawns[i];
          return false;
        });

        for (let res in Memory.log.hives[key].resourceBalance)
          for (let ref in Memory.log.hives[key].resourceBalance[<ResourceConstant>res]) {
            let diff = Game.time - Memory.log.hives[key].resourceBalance[<ResourceConstant>res]![ref].time;
            if (diff >= LOGGING_CYCLE * 2) {
              Memory.log.hives[key].resourceBalance[<ResourceConstant>res]![ref] = {
                time: Game.time - Math.floor(diff / 2),
                amount: Math.floor(Memory.log.hives[key].resourceBalance[<ResourceConstant>res]![ref].amount / 2),
              }
            }
          }
      }

      if (Memory.log.orders && Object.keys(Memory.log.orders).length > 25) {
        let j = Object.keys(Memory.log.orders).length - 10;
        for (let i in Memory.log.orders) {
          if (Memory.log.orders[i].time + LOGGING_CYCLE * 3 > Game.time || Memory.log.orders[i].destroyTime == -1) continue;
          delete Memory.log.orders[i];
          if (--j == 0) break;
        }
      }

      if (Memory.log.crashes && Object.keys(Memory.log.crashes).length > 100) {
        let j = Object.keys(Memory.log.crashes).length - 50;
        for (let key in Memory.log.crashes) {
          delete Memory.log.crashes[key];
          if (--j == 0) break;
        }
      }

      if (Memory.log.enemies && Object.keys(Memory.log.enemies).length > 50) {
        let j = Object.keys(Memory.log.enemies).length - 35;
        for (let key in Memory.log.enemies) {
          delete Memory.log.enemies[key];
          if (--j == 0) break;
        }
      }
    }
  }
}
