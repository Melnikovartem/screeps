// import { setupsNames } from "../enums";
import { setups } from "../bees/creepSetups";
import { roomStates } from "../enums";

import { profile } from "../profiler/decorator";
import { LOGGING_CYCLE } from "../settings";
import type { Hive } from "../hive";
import type { FlagOrder } from "../order";
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
        time: Game.time,
        gcl: { level: Game.gcl.level, progress: Game.gcl.progress, progressTotal: Game.gcl.progressTotal },
        gpl: { level: Game.gpl.level, progress: Game.gpl.progress, progressTotal: Game.gpl.progressTotal },
        cpu: { limit: Game.cpu.limit, used: 0, bucket: Game.cpu.bucket },
        cpuUsage: { run: {}, update: {} },
        pixels: 0,
        credits: 0,
        lastRebalance: Game.time,
        hives: {}
      };
    if (force || !Memory.report)
      Memory.report = { orders: {}, enemies: {}, crashes: {} }
  }

  update() {
    Memory.log.cpuUsage = { update: {}, run: {} };
  }

  run() {
    let cpu = Game.cpu.getUsed();
    _.forEach(Apiary.hives, hive => {
      this.hiveLog(hive);
    });

    Memory.log.time = Game.time;
    Memory.log.credits = Game.market.credits;
    Memory.log.pixels = Game.resources["pixel"];
    Memory.log.gcl = { level: Game.gcl.level, progress: Game.gcl.progress, progressTotal: Game.gcl.progressTotal };
    Memory.log.gpl = { level: Game.gpl.level, progress: Game.gpl.progress, progressTotal: Game.gpl.progressTotal };
    this.reportCPU("log", "run", Game.cpu.getUsed() - cpu, Object.keys(Apiary.hives).length); // possible for norm -> 1
    Memory.log.cpu = { limit: Game.cpu.limit, used: Game.cpu.getUsed(), bucket: Game.cpu.bucket };
  }

  reportCPU(ref: string, mode: "run" | "update", usedCPU: number, amount: number) {
    if (usedCPU < 0.01)
      return;
    Memory.log.cpuUsage[mode][ref] = { cpu: usedCPU, norm: usedCPU / (amount || 1) };
  }

  hiveLog(hive: Hive) {
    let mem = Memory.log.hives[hive.roomName];
    if (!mem)
      return;
    mem.annexNames = hive.annexNames;
    mem.spawOrders = Object.keys(hive.spawOrders).length;
    mem.structuresConst = hive.structuresConst.length;
    mem.sumCost = hive.sumCost;

    mem.storageEnergy = (hive.room.storage ? hive.room.storage.store.energy : 0);
    mem.terminalEnergy = (hive.room.terminal ? hive.room.terminal.store.energy : 0);
    mem.energyAvailable = hive.room.energyAvailable;
    mem.energyCapacityAvailable = hive.room.energyCapacityAvailable;
    mem.controllerProgress = hive.controller.progress;
    mem.controllerProgressTotal = hive.controller.progressTotal;
    mem.controllerLevel = hive.controller.level;

    if (Game.time % 5 === 0) {
      mem.defenseHealth = [];
      let plan = Memory.cache.roomPlanner[hive.roomName];
      if (plan)
        _.forEach([STRUCTURE_WALL, STRUCTURE_RAMPART], defense => {
          _.forEach((plan[defense] || { pos: [] }).pos, p => {
            let pos = new RoomPosition(p.x, p.y, hive.roomName);
            let ss = pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === defense)[0];
            mem.defenseHealth.push(ss && ss.hits || 0)
          });
        });
      mem.nukes = {};
      _.forEach(hive.cells.defense.nukes, nuke => {
        mem.nukes[nuke.id] = { [nuke.launchRoomName]: nuke.timeToLand };
      });
      mem.energyReport = this.reportEnergy(hive.roomName);
      mem.resState = hive.resState;
    }
  }

  addResourceStat(hiveName: string, ref: string, amount: number, resource: ResourceConstant = RESOURCE_ENERGY) {
    if (!Memory.log.hives[hiveName])
      return ERR_NOT_FOUND;
    if (!Memory.log.hives[hiveName].resourceBalance[resource])
      Memory.log.hives[hiveName].resourceBalance[resource] = {};
    if (!Memory.log.hives[hiveName].resourceBalance[resource]![ref])
      Memory.log.hives[hiveName].resourceBalance[resource]![ref] = 0;

    Memory.log.hives[hiveName].resourceBalance[resource]![ref] += amount;
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

  newSpawn(beeName: string, spawn: StructureSpawn, cost: number, masterName: string) {
    let name = beeName.substring(0, beeName.length - 5);
    if (name === setups.miner.energy.name)
      name = masterName.slice(masterName.length - 4);
    this.addResourceStat(spawn.pos.roomName, "spawn_" + name, -cost);
    return OK;
  }

  marketShort(order: Order | ProtoOrder, amount: number, hiveName: string) {
    let res = <ResourceConstant>order.resourceType;
    if (!RESOURCES_ALL.includes(res) || !order.roomName)
      return;
    this.addResourceStat(hiveName, "terminal", -Game.market.calcTransactionCost(amount, hiveName, order.roomName));

    let type = "import";
    if (order.type === ORDER_BUY) {
      amount *= -1;
      type = "export"
    }
    this.addResourceStat(hiveName, type, amount, res);
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

  initHive(hiveName: string) {
    if (!Memory.log.hives[hiveName])
      Memory.log.hives[hiveName] = {
        annexNames: [],
        structuresConst: 0,
        sumCost: 0,
        spawOrders: 0,

        storageEnergy: 0,
        terminalEnergy: 0,
        energyAvailable: 0,
        energyCapacityAvailable: 0,
        controllerProgress: 0,
        controllerProgressTotal: 0,
        controllerLevel: 0,

        nukes: {},
        resState: {},
        defenseHealth: [],
        energyReport: {},
        resourceBalance: { [RESOURCE_ENERGY]: {} },
      }
  }

  reportEnergy(hiveName: string): { [id: string]: number } {
    let hive = Apiary.hives[hiveName];
    let stats = Memory.log.hives[hiveName].resourceBalance[RESOURCE_ENERGY]!;
    let ans: { [id: string]: number } = {};
    let getRate = (ref: string): number => stats[ref] ? stats[ref] / (Game.time - Memory.log.lastRebalance || 1) : 0;
    let getCreepCostRate = (setup: { name: string }) => getRate("spawn_" + setup.name);
    let excavation = Apiary.hives[hiveName].cells.excavation;

    // well here is also the mineral hauling cost but fuck it
    let haulerExp = getCreepCostRate(setups.hauler);
    let annexExp = getCreepCostRate(setups.claimer);
    let skExp = getCreepCostRate(setups.defender.sk);

    let haulerNum = 0;
    _.forEach(excavation.resourceCells, cell => {
      if (cell.resourceType === RESOURCE_ENERGY && !cell.link) haulerNum++;
    });
    haulerExp /= Math.max(haulerNum, 1);

    let annexesSK = hive.annexNames.filter(annexName => {
      let roomInfo = Apiary.intel.getInfo(annexName, Infinity);
      return roomInfo.roomState === roomStates.SKfrontier || roomInfo.roomState === roomStates.SKcentral;
    });
    annexExp /= hive.annexNames.length - annexesSK.length; // per room
    skExp /= annexesSK.length;

    _.forEach(excavation.resourceCells, cell => {
      if (cell.resourceType !== RESOURCE_ENERGY)
        return;
      let ref = cell.ref.slice(cell.ref.length - 4);
      let annexExpCell = 0;
      if (annexesSK.includes(cell.pos.roomName))
        annexExpCell = skExp / (excavation.roomResources[cell.pos.roomName] - 1);
      else if (hive.annexNames.includes(cell.pos.roomName))
        annexExpCell = annexExp / excavation.roomResources[cell.pos.roomName];
      ans["mining_" + ref] = getRate("mining_" + ref) + getRate("upkeep_" + ref) + getCreepCostRate({ name: ref })
        + (cell.link ? 0 : haulerExp) + annexExpCell;
    });

    ans["upgrade"] = getRate("upgrade") + getCreepCostRate(setups.upgrader.fast);
    ans["mineral"] = getCreepCostRate(setups.miner.minerals);
    ans["corridor_deposit"] = getCreepCostRate(setups.miner.deposit) + getCreepCostRate(setups.puller);
    ans["corridor_power"] = getCreepCostRate(setups.miner.power) + getCreepCostRate(setups.miner.powerhealer);
    ans["corridor_pickup"] = getCreepCostRate(setups.pickup);

    ans["build"] = getRate("build") + getRate("defense_build") + getCreepCostRate(setups.builder);

    ans["defense_tower"] = getRate("defense_heal") + getRate("defense_dmg") + getRate("defense_repair");
    ans["defense_swarms"] = getCreepCostRate(setups.defender.normal) + getCreepCostRate(setups.defender.destroyer);
    ans["attack_rooms"] = getCreepCostRate(setups.knight) + getCreepCostRate(setups.downgrader) + getCreepCostRate(setups.dismantler) + getCreepCostRate(setups.healer);

    ans["export"] = getRate("export") + getRate("export local");
    ans["import"] = getRate("import") + getRate("import local");
    ans["terminal"] = getRate("terminal");
    ans["lab"] = getRate("boosts") + getRate("lab");
    ans["production"] = getRate("factory") + getRate("power_upgrade");
    ans["larva"] = getRate("larva") + + getCreepCostRate(setups.bootstrap);
    ans["upkeep"] = getCreepCostRate(setups.queen) + getRate("upkeep");

    return ans;
  }

  reportEnemy(creep: Creep) {
    if (!Memory.report.enemies)
      Memory.report.enemies = {};

    Memory.report.enemies[creep.pos.roomName + "_" + creep.owner.username] = {
      time: Game.time,
      owner: creep.owner.username,
      ...Apiary.intel.getStats(creep).max,
    }
  }

  reportOrder(order: FlagOrder) {
    if (!order.master)
      return;
    if (!Memory.report.orders)
      Memory.report.orders = {};
    let repeat = order.memory.repeat ? "_" + order.memory.repeat : "";
    Memory.report.orders[order.ref + repeat] = {
      time: Game.time,
      pos: order.pos,
    }
  }

  clean() {
    if (Game.time % LOGGING_CYCLE === 0) {
      if (Game.time % LOGGING_CYCLE * 4 === 0) {
        Memory.log.lastRebalance = (Game.time + Memory.log.lastRebalance) / 2;
        for (let key in Memory.log.hives) {
          let resourceBalance = Memory.log.hives[key].resourceBalance;
          for (let r in resourceBalance) {
            let res = <ResourceConstant>r;
            for (let ref in resourceBalance[res]) {
              resourceBalance[res]![ref] = resourceBalance[res]![ref] / 2;
              if (Math.abs(resourceBalance[res]![ref]) < Math.pow(10, -4))
                resourceBalance[res]![ref] = 0;
            }
          }
        }
      }

      if (Memory.report.orders && Object.keys(Memory.report.orders).length > 50) {
        let sortedKeys = Object.keys(Memory.report.orders)
          .sort((a, b) => Memory.report.orders![b].time - Memory.report.orders![a].time);
        for (let i = sortedKeys.length - 20; i >= 0; --i)
          delete Memory.report.orders[sortedKeys[i]];
      }

      if (Memory.report.crashes && Object.keys(Memory.report.crashes).length > 50) {
        let sortedKeys = Object.keys(Memory.report.crashes)
          .sort((a, b) => Memory.report.crashes![b].time - Memory.report.crashes![a].time);
        for (let i = sortedKeys.length - 20; i >= 0; --i)
          delete Memory.report.crashes[sortedKeys[i]];
      }

      if (Memory.report.enemies && Object.keys(Memory.report.enemies).length > 50) {
        let sortedKeys = Object.keys(Memory.report.enemies)
          .sort((a, b) => Memory.report.enemies![b].time - Memory.report.enemies![a].time);
        for (let i = sortedKeys.length - 20; i >= 0; --i)
          delete Memory.report.enemies[sortedKeys[i]];
      }
    }
  }
}
