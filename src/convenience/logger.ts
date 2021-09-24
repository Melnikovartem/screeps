import type { Hive } from "../hive";
import { setupsNames } from "../bees/creepSetups";

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
    storeTo: Store<R, false>, resource: R = <R>RESOURCE_ENERGY, mode: 1 | -1 = -1, loss: number = 0) {
    if (!Memory.log.hives[hiveName])
      return ERR_NOT_FOUND;
    let amount = Math.floor(Math.min(+storeFrom.getUsedCapacity(resource), +storeTo.getFreeCapacity(resource)) * mode * (1 - loss));
    this.addResourceStat(hiveName, ref, amount, resource);
    return OK;
  }

  newSpawn(beeName: string, spawn: StructureSpawn, cost: number, priority: number, masterName: string) {
    let hiveName = Apiary.masters[masterName] ? Apiary.masters[masterName].hive.roomName : spawn.pos.roomName;
    if (!Memory.log.hives[hiveName])
      return ERR_NOT_FOUND;
    Memory.log.hives[hiveName].spawns[beeName] = {
      time: Game.time,
      fromSpawn: spawn.name,
      orderedBy: masterName,
      priority: priority,
    };

    this.addResourceStat(spawn.pos.roomName, "spawn_" + beeName.substring(0, beeName.length - 5), -cost);
    return OK;
  }

  newMarketOperation(order: Order, amount: number, hiveName: string) {
    if (!order.roomName)
      return;
    this.addResourceStat(hiveName, order.type === ORDER_BUY ? "export" : "import", order.type === ORDER_BUY ? -amount : amount, <ResourceConstant>order.resourceType);
    this.addResourceStat(hiveName, "terminal", -Game.market.calcTransactionCost(amount, hiveName, order.roomName));
  }

  newTerminalTransfer(terminalFrom: StructureTerminal, terminalTo: StructureTerminal, amount: number, resource: ResourceConstant) {
    this.addResourceStat(terminalFrom.pos.roomName, "export local", -amount, resource);
    this.addResourceStat(terminalTo.pos.roomName, "import local", amount, resource);
    this.addResourceStat(terminalFrom.pos.roomName, "terminal", -Game.market.calcTransactionCost(amount, terminalFrom.pos.roomName, terminalTo.pos.roomName));
  }

  hiveLog(hive: Hive) {
    if (!Memory.log.hives[hive.roomName])
      return ERR_NOT_FOUND;
    if (Game.time % LOGGING_CYCLE * 10 === 0) {
      let orderMap: { [id: string]: { amount: number, priority: number } } = {};

      for (const ref in hive.spawOrders) {
        orderMap[ref] = {
          amount: hive.spawOrders[ref].amount,
          priority: hive.spawOrders[ref].priority,
        };
      }

      Memory.log.hives[hive.roomName].loggedStates[Game.time] = {
        annexNames: hive.annexNames,
        structuresConst: hive.structuresConst.length,
        sumCost: hive.sumCost,
        spawOrders: orderMap,
      };
      return OK;
    }
    return ERR_BUSY;
  }

  clean() {
    if (Game.time % LOGGING_CYCLE === 0) {
      for (let key in Memory.log.hives) {
        let sortedKeys: string[] = Object.keys(Memory.log.hives[key].loggedStates)
          .sort((a, b) => +b - +a);
        let j = sortedKeys.length - 10;
        _.some(sortedKeys, (i) => {
          if (--j <= 0) return true;
          delete Memory.log.hives[key].loggedStates[+i];
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
            if (diff >= LOGGING_CYCLE * 10) {
              Memory.log.hives[key].resourceBalance[<ResourceConstant>res]![ref] = {
                time: Game.time - Math.floor(diff / 2),
                amount: Math.floor(Memory.log.hives[key].resourceBalance[<ResourceConstant>res]![ref].amount / 2),
              }
            }
          }
      }

      if (Object.keys(Memory.log.orders).length > 50) {
        let sortedKeys = Object.keys(Memory.log.orders).sort((a, b) => Memory.log.orders[b].time - Memory.log.orders[a].time);
        let j = sortedKeys.length - 25;
        _.some(sortedKeys, (i) => {
          if (--j <= 0) return true;
          if (Memory.log.orders[i].destroyTime !== -1)
            delete Memory.log.orders[i];
          return false;
        });
      }

      if (Memory.log.crashes)
        if (Object.keys(Memory.log.crashes).length > 100) {
          let sortedKeys = Object.keys(Memory.log.crashes).sort((a, b) => Memory.log.crashes[b].time - Memory.log.crashes[a].time);
          let j = sortedKeys.length - 25;
          _.some(sortedKeys, (i) => {
            if (--j <= 0) return true;
            delete Memory.log.crashes[i];
            return false;
          });
        }

      if (Memory.log.enemies && Object.keys(Memory.log.enemies).length > 50) {
        let j = Object.keys(Memory.log.enemies).length - 35;
        for (let key in Memory.log.enemies) {
          delete Memory.log.enemies[key];
          if (--j === 0) break;
        }
      }
    }
  }

  reportEnergy(hiveName: string, extra: boolean = false): { [id: string]: { profit: number, revenue?: number } } {
    let hive = Apiary.hives[hiveName];
    let stats = Memory.log.hives[hiveName].resourceBalance[RESOURCE_ENERGY]!;
    let ans: { [id: string]: { profit: number, revenue?: number } } = {};
    let getRate = (ref: string): number => stats[ref] ? stats[ref].amount / Math.max(Game.time - stats[ref].time, 1) : 0;
    let excavation = Apiary.hives[hiveName].cells.excavation;
    if (excavation) {
      // well here is also the mineral hauling cost but fuck it
      let haulerExp = getRate("spawn_" + setupsNames.hauler);
      let minerExp = getRate("spawn_" + setupsNames.miner);
      let annexExp = getRate("spawn_" + setupsNames.claimer);
      if (extra) {
        ans["hauler"] = { profit: haulerExp };
        ans["miner"] = { profit: minerExp };
        ans["annex"] = { profit: annexExp };
      }

      let minerNum = 0;
      let haulerNum = 0;
      _.forEach(hive.cells.excavation!.resourceCells, (cell) => {
        if (cell.resourceType === RESOURCE_ENERGY) {
          minerNum++;
          if (!cell.link) haulerNum++;
        }
      });
      haulerExp /= Math.max(haulerNum, 1);
      minerExp /= Math.max(minerNum, 1);
      annexExp /= hive.annexNames.length;

      _.forEach(excavation.resourceCells, (cell) => {
        if (cell.resourceType === RESOURCE_ENERGY) {
          let ref = "mining_" + cell.resource.id.slice(cell.resource.id.length - 4);
          ans[ref] = {
            profit: getRate(ref) + minerExp + (cell.link ? 0 : haulerExp)
              + (cell.pos.roomName !== hive.roomName && hive.annexNames.includes(cell.pos.roomName)
                ? annexExp / excavation!.roomResources[cell.pos.roomName] : 0),
            revenue: getRate(ref) * (cell.link ? 1 / 0.97 : 1),
          };
        }
      });
    }

    ans["upgrade"] = { profit: getRate("upgrade") + getRate("spawn_" + setupsNames.upgrader), revenue: getRate("upgrade") };
    ans["mineral"] = { profit: getRate("spawn_" + setupsNames.miner + " M") };
    ans["build"] = { profit: getRate("build") + getRate("spawn_" + setupsNames.builder), revenue: getRate("build") };
    ans["defense"] = { profit: getRate("build") + getRate("spawn_" + setupsNames.defender) };
    ans["export"] = { profit: getRate("export") + getRate("export local"), revenue: getRate("export") };
    ans["import"] = { profit: getRate("import") + getRate("import local"), revenue: getRate("import") };
    ans["terminal"] = { profit: getRate("terminal") };
    ans["terminal"] = { profit: getRate("boosts") + getRate("lab"), revenue: getRate("boosts") };

    type civilRoles = "queen" | "manager" | "claimer";
    ans["upkeep"] = { profit: _.sum(<civilRoles[]>["queen", "manager", "claimer"], (s) => getRate("spawn_" + setupsNames[s])) };

    return ans;
  }
}
