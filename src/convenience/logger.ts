// import { setupsNames } from "../enums";
import { setups } from "../bees/creepSetups";
import { roomStates } from "../enums";

import { profile } from "../profiler/decorator";
import { LOGGING_CYCLE } from "../settings";
import type { Hive } from "../hive";
import type { ProtoOrder } from "../abstract/broker";

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
        resourceBalance: { [RESOURCE_ENERGY]: {} },
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
    storeTo: Store<R, false>, resource: R = <R>RESOURCE_ENERGY, mode: 1 | -1 = -1, loss?: { ref: string, per: number }) {
    if (!Memory.log.hives[hiveName])
      return ERR_NOT_FOUND;
    let amount = Math.floor(Math.min(+storeFrom.getUsedCapacity(resource), +storeTo.getFreeCapacity(resource)) * mode); // * (1 - loss)
    this.addResourceStat(hiveName, ref, amount, resource);
    if (loss)
      this.addResourceStat(hiveName, loss.ref, - amount * loss.per, resource);
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
    let name = beeName.substring(0, beeName.length - 5);
    if (name === setups.miner.energy.name || name === setups.miner.minerals.name)
      this.addResourceStat(spawn.pos.roomName, "upkeep_" + masterName.slice(masterName.length - 4), -cost);
    this.addResourceStat(spawn.pos.roomName, "spawn_" + name, -cost);
    return OK;
  }

  marketShort(order: Order | ProtoOrder, amount: number, hiveName: string) {
    let res = <ResourceConstant>order.resourceType;
    if (!RESOURCES_ALL.includes(res) || !order.roomName)
      return;
    let type = "import";
    if (order.type === ORDER_BUY) {
      amount *= -1;
      type = "export"
    }
    this.addResourceStat(hiveName, type, amount, res);
    this.addResourceStat(hiveName, "terminal", -Game.market.calcTransactionCost(amount, hiveName, order.roomName));
  }

  marketLong(order: Order) {
    let res = <ResourceConstant>order.resourceType;
    if (!RESOURCES_ALL.includes(res) || !order.roomName)
      return;
    let amount = order.totalAmount ? order.totalAmount - order.remainingAmount : 0;
    let type = "import";
    if (order.type === ORDER_SELL) {
      amount *= -1;
      type = "export"
    }
    this.addResourceStat(order.roomName, type, amount, res);
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
      let orderMap: { [id: string]: number } = {};

      for (const ref in hive.spawOrders) {
        orderMap[ref] = hive.spawOrders[ref].priority;
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

  reportEnemy(creep: Creep) {
    if (!Memory.log.enemies)
      Memory.log.enemies = {};

    Memory.log.enemies[creep.pos.roomName + "_" + creep.owner.username] = {
      time: Game.time,
      info: Apiary.intel.getStats(creep),
      pos: creep.pos,
      owner: creep.owner.username,
    }
  }

  clean() {
    if (Game.time % LOGGING_CYCLE === 0) {
      for (let key in Memory.log.hives) {
        let sortedKeys: string[] = Object.keys(Memory.log.hives[key].loggedStates).sort((a, b) => +b - +a);

        for (let i = sortedKeys.length - 25; i >= 0; --i)
          delete Memory.log.hives[key].loggedStates[+sortedKeys[i]];

        sortedKeys = Object.keys(Memory.log.hives[key].spawns)
          .sort((a, b) => Memory.log.hives[key].spawns[b].time - Memory.log.hives[key].spawns[a].time);
        for (let i = sortedKeys.length - 25; i >= 0; --i)
          delete Memory.log.hives[key].spawns[sortedKeys[i]];

        for (let res in Memory.log.hives[key].resourceBalance)
          for (let ref in Memory.log.hives[key].resourceBalance[<ResourceConstant>res]) {
            let diff = Game.time - Memory.log.hives[key].resourceBalance[<ResourceConstant>res]![ref].time;
            if (diff >= LOGGING_CYCLE * 25) {
              Memory.log.hives[key].resourceBalance[<ResourceConstant>res]![ref] = {
                time: Game.time - Math.floor(diff / 2),
                amount: Math.floor(Memory.log.hives[key].resourceBalance[<ResourceConstant>res]![ref].amount / 2),
              }
            }
          }
      }

      if (Memory.log.orders && Object.keys(Memory.log.orders).length > 50) {
        let sortedKeys = Object.keys(Memory.log.orders)
          .sort((a, b) => Memory.log.orders![b].time - Memory.log.orders![a].time);
        for (let i = sortedKeys.length - 20; i >= 0; --i)
          delete Memory.log.orders[sortedKeys[i]];
      }

      if (Memory.log.crashes && Object.keys(Memory.log.crashes).length > 50) {
        let sortedKeys = Object.keys(Memory.log.crashes)
          .sort((a, b) => Memory.log.crashes![b].time - Memory.log.crashes![a].time);
        for (let i = sortedKeys.length - 20; i >= 0; --i)
          delete Memory.log.crashes[sortedKeys[i]];
      }

      if (Memory.log.enemies && Object.keys(Memory.log.enemies).length > 50) {
        let sortedKeys = Object.keys(Memory.log.enemies)
          .sort((a, b) => Memory.log.enemies![b].time - Memory.log.enemies![a].time);
        for (let i = sortedKeys.length - 20; i >= 0; --i)
          delete Memory.log.enemies[sortedKeys[i]];
      }
    }
  }

  reportEnergy(hiveName: string, extra: boolean = false): { [id: string]: { profit: number, revenue?: number } } {
    let hive = Apiary.hives[hiveName];
    let stats = Memory.log.hives[hiveName].resourceBalance[RESOURCE_ENERGY]!;
    let ans: { [id: string]: { profit: number, revenue?: number } } = {};
    let getRate = (ref: string): number => stats[ref] ? stats[ref].amount / Math.max(Game.time - stats[ref].time, 1) : 0;
    let getCreepCostRate = (setup: { name: string }) => getRate("spawn_" + setup.name);
    let excavation = Apiary.hives[hiveName].cells.excavation;
    if (excavation) {
      // well here is also the mineral hauling cost but fuck it
      let haulerExp = getCreepCostRate(setups.hauler);
      let minerExp = getCreepCostRate(setups.miner.energy);
      let annexExp = getCreepCostRate(setups.claimer);
      let skExp = getCreepCostRate(setups.defender.sk);

      if (extra) {
        ans["hauler"] = { profit: haulerExp };
        ans["miner"] = { profit: minerExp };
        ans["annex"] = { profit: annexExp };
        ans["annexSK"] = { profit: skExp };
      }

      let haulerNum = 0;
      _.forEach(hive.cells.excavation!.resourceCells, cell => {
        if (cell.resourceType === RESOURCE_ENERGY)
          if (!cell.link) haulerNum++;
      });
      haulerExp /= Math.max(haulerNum, 1);

      let annexesSK = hive.annexNames.filter(annexName => {
        let roomInfo = Apiary.intel.getInfo(annexName, Infinity);
        return roomInfo.roomState === roomStates.SKfrontier || roomInfo.roomState === roomStates.SKcentral;
      });
      annexExp /= hive.annexNames.length - annexesSK.length;
      skExp /= annexesSK.length;

      _.forEach(excavation.resourceCells, cell => {
        if (cell.resourceType === RESOURCE_ENERGY) {
          let ref = "mining_" + cell.ref.slice(cell.ref.length - 4);
          let upkeep = "upkeep_" + cell.ref.slice(cell.ref.length - 4);
          let annexExpCell = 0;
          if (cell.pos.roomName !== hive.roomName && hive.annexNames.includes(cell.pos.roomName))
            if (annexesSK.includes(cell.pos.roomName))
              annexExpCell = skExp;
            else
              annexExpCell = annexExp;
          ans[ref] = {
            profit: getRate(ref) + getRate(upkeep) + (cell.link ? 0 : haulerExp) + annexExpCell / excavation!.roomResources[cell.pos.roomName],
            revenue: getRate(ref),
          };
        }
      });
    }

    ans["upgrade"] = { profit: getRate("upgrade") + getCreepCostRate(setups.upgrader.fast), revenue: getRate("upgrade") };
    ans["mineral"] = { profit: getCreepCostRate(setups.miner.minerals) };
    ans["corridor"] = {
      profit: getCreepCostRate(setups.miner.deposit)
        + getCreepCostRate(setups.puller) + getCreepCostRate(setups.pickup)
        + getCreepCostRate(setups.miner.power) + getCreepCostRate(setups.miner.powerhealer)
    };
    ans["build"] = { profit: getRate("build") + getCreepCostRate(setups.miner.deposit), revenue: getRate("build") };
    ans["defense_dmg"] = {
      profit: getRate("defense_dmg")
        + getCreepCostRate(setups.defender.normal)
        + getCreepCostRate(setups.defender.destroyer),
      revenue: getRate("defense_dmg")
    };
    ans["defense_repair"] = { profit: getRate("defense_repair") };
    ans["defense_heal"] = { profit: getRate("defense_heal") };
    ans["export"] = { profit: getRate("export") + getRate("export local"), revenue: getRate("export") };
    ans["import"] = { profit: getRate("import") + getRate("import local"), revenue: getRate("import") };
    ans["terminal"] = { profit: getRate("terminal") };
    ans["terminal"] = { profit: getRate("boosts") + getRate("lab"), revenue: getRate("boosts") };
    ans["larva"] = { profit: getRate("larva") + + getCreepCostRate(setups.bootstrap), revenue: getRate("larva") };
    ans["upkeep"] = { profit: + getCreepCostRate(setups.queen) };

    return ans;
  }
}
