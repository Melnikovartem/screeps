import { Master } from "../_Master";

import { beeStates, hiveStates } from "../../enums";
import { setups } from "../../bees/creepsetups";
import { findOptimalResource } from "../../abstract/utils";
import { BASE_MINERALS } from "../../cells/stage1/laboratoryCell";

import { profile } from "../../profiler/decorator";
import type { ExcavationCell } from "../../cells/base/excavationCell";
import type { Bee } from "../../bees/bee";

@profile
export class HaulerMaster extends Master {
  cell: ExcavationCell;
  targetMap: { [id: string]: string | undefined } = {};
  roadUpkeepCost: { [id: string]: number } = {};
  accumRoadTime = 0;
  dropOff: StructureStorage | StructureTerminal; // | StructureContainer | StructureLink;
  minRoadTime: number = 0;

  constructor(excavationCell: ExcavationCell, storage: StructureStorage | StructureTerminal) {
    super(excavationCell.hive, excavationCell.ref);
    this.cell = excavationCell;
    this.dropOff = storage;
    this.recalculateTargetBee();
  }

  newBee(bee: Bee) {
    if (bee.state === beeStates.idle && bee.store.getUsedCapacity())
      bee.state = beeStates.work;
    super.newBee(bee);
  }

  deleteBee(ref: string) {
    super.deleteBee(ref);
    delete this.roadUpkeepCost[ref];
  }

  recalculateRoadTime() {
    this.accumRoadTime = 0; // roadTime * minePotential
    this.minRoadTime = Infinity;
    if (this.hive.cells.storage)
      _.forEach(this.cell.resourceCells, cell => {
        if (cell.operational && cell.roadTime !== Infinity && cell.restTime !== Infinity && cell.container && !cell.link) {
          let coef = cell.master.ratePT;
          this.accumRoadTime += (cell.roadTime + cell.restTime) * coef;
          if (cell.restTime < this.minRoadTime)
            this.minRoadTime = cell.restTime;
        }
      });
    if (this.minRoadTime === Infinity)
      this.minRoadTime = 0;
    this.cell.shouldRecalc = false;
  }

  recalculateTargetBee() {
    let body = setups.hauler.getBody(this.hive.room.energyCapacityAvailable).body;
    this.cell.fullContainer = Math.min(CONTAINER_CAPACITY, body.filter(b => b === CARRY).length * CARRY_CAPACITY);
    let rounding = (x: number) => Math.max(1, Math.ceil(x - 0.15));
    if (this.hive.state === hiveStates.lowenergy)
      rounding = x => Math.max(1, Math.floor(x + 0.15));
    this.targetBeeCount = rounding(this.accumRoadTime / this.cell.fullContainer);

    /*
    let period = CREEP_LIFE_TIME - this.minRoadTime - 10;
    let spawnTime = body.length * CREEP_SPAWN_TIME;
    this.targetBeeCount = Math.min(this.targetBeeCount, Math.ceil(period * Object.keys(this.hive.cells.spawn.spawns).length / spawnTime * 0.5));
    */
  }

  checkBeesWithRecalc() {
    let check = () => this.checkBees(hiveStates.battle !== this.hive.state || !this.beesAmount || !Object.keys(this.hive.spawOrders).length, CREEP_LIFE_TIME - this.minRoadTime - 10);
    if (this.targetBeeCount && !check())
      return false;
    this.recalculateTargetBee();
    return check();
  }

  update() {
    super.update();

    if (this.dropOff.store.getFreeCapacity() <= this.dropOff.store.getCapacity() * 0.005)
      return;

    _.forEach(this.cell.quitefullCells, cell => {
      let container = cell.container;
      if (!container)
        return;

      let target = this.targetMap[container.id];
      let oldBee = target && this.bees[target];
      if (oldBee && oldBee.target === container.id)
        return;

      let bee = container.pos.findClosest(_.filter(this.activeBees, b => b.state === beeStates.chill && b.ticksToLive >= cell.roadTime + b.pos.getRangeApprox(cell) + 15));
      if (bee) {
        bee.state = beeStates.refill;
        bee.target = container.id;
        this.roadUpkeepCost[bee.ref] = 0;
        this.targetMap[container.id] = bee.ref;
      }
    });

    if (this.cell.shouldRecalc) {
      this.recalculateRoadTime();
      this.recalculateTargetBee();
    }

    if (this.checkBeesWithRecalc()) {
      this.wish({
        setup: setups.hauler,
        priority: this.beesAmount ? 5 : 3,
      });
    }
  }

  run() {
    _.forEach(this.activeBees, bee => {
      if (bee.state === beeStates.chill && bee.store.getUsedCapacity() > 0)
        bee.state = beeStates.work;
      /* if (this.hive.cells.defense.timeToLand < 50) {
        if (bee.pos.roomName === this.hive.roomName || bee.pos.getEnteranceToRoom()) {
          let exit = Game.map.describeExits(this.hive.roomName)
          let exitToGo = Object.keys(exit)[0];
          bee.goRest(new RoomPosition(25, 25, exitToGo));
        }
        this.checkFlee(bee);
        return;
      } */
      let res: ResourceConstant;
      switch (bee.state) {
        case beeStates.refill:
          if (!bee.target || !this.targetMap[bee.target]) {
            bee.state = beeStates.work;
            break;
          }

          let target = <StructureContainer | undefined>Game.getObjectById(bee.target);

          if (!target) {
            this.targetMap[bee.target] = undefined;
            bee.target = undefined;
            if (bee.store.getUsedCapacity())
              bee.state = beeStates.work;
            else
              bee.state = beeStates.chill;
            break;
          }

          let roomInfo = Apiary.intel.getInfo(target.pos.roomName, 20);
          if (!roomInfo.safePlace) {
            this.targetMap[bee.target] = undefined;
            bee.target = undefined;
            bee.state = beeStates.chill;
            break;
          }

          if (bee.pos.getRangeTo(target) > 3) {
            let opt = this.hive.opt;
            opt.offRoad = true;
            bee.goTo(target, opt);
            break;
          }

          // overproduction or energy from SK defenders
          let overproduction: Resource | Tombstone | undefined = target.pos.findInRange(FIND_DROPPED_RESOURCES, 3)[0];
          if (overproduction)
            bee.pickup(overproduction);
          else {
            overproduction = target.pos.findInRange(FIND_TOMBSTONES, 3).filter(t => t.store.getUsedCapacity() > 0)[0];
            if (overproduction)
              bee.withdraw(overproduction, findOptimalResource(overproduction.store));
          }

          if (!bee.store.getFreeCapacity() || !overproduction && bee.withdraw(target, findOptimalResource(target.store)) === OK && Object.keys(target.store).length < 2) {
            this.targetMap[bee.target] = undefined;
            bee.state = beeStates.work;
            let source: Source | Mineral | null = bee.pos.findClosest(target.pos.findInRange(FIND_SOURCES, 1));
            if (!source)
              source = bee.pos.findClosest(target.pos.findInRange(FIND_MINERALS, 1));
            bee.target = source ? source.id : undefined;
          }
          break;
        case beeStates.work:
          res = findOptimalResource(bee.store);

          if (bee.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && bee.repairRoadOnMove() === OK)
            this.roadUpkeepCost[bee.ref]++;
          if (bee.store.getFreeCapacity() > 0) {
            let resource = bee.pos.lookFor(LOOK_RESOURCES)[0];
            if (resource)
              bee.pickup(resource);
          }

          let ans = bee.transfer(this.dropOff, res);
          if (ans === OK) {
            if (Apiary.logger && bee.target) {
              let source = Game.getObjectById(bee.target);
              let sameRes;
              if (source instanceof Source)
                sameRes = res === RESOURCE_ENERGY;
              else if (source instanceof Mineral)
                sameRes = source.mineralType === res;
              else
                sameRes = res === RESOURCE_ENERGY || BASE_MINERALS.includes(res);

              let ref = sameRes ? "mining_" + bee.target.slice(bee.target.length - 4) : "pickup";

              if (this.roadUpkeepCost[bee.ref] > 0) {
                Apiary.logger.addResourceStat(this.hive.roomName, ref, this.roadUpkeepCost[bee.ref]);
                Apiary.logger.addResourceStat(this.hive.roomName,
                  sameRes ? "upkeep_" + bee.target.slice(bee.target.length - 4) : "build",
                  -this.roadUpkeepCost[bee.ref]);
                this.roadUpkeepCost[bee.ref] = 0;
              }
              Apiary.logger.resourceTransfer(this.hive.roomName, ref, bee.store, this.dropOff.store, res, 1);
            }
          } else if (bee.pos.getRangeTo(this.hive) <= 8 && bee.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            let ss = (<(StructureSpawn | StructureExtension)[]>bee.pos.findInRange(FIND_MY_STRUCTURES, 1)
              .filter(s => s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN))
              .filter(s => s.store.getFreeCapacity(RESOURCE_ENERGY))[0];
            if (ss && bee.transfer(ss, RESOURCE_ENERGY) === OK)
              if (Apiary.logger && bee.target) {
                let ref = "mining_" + bee.target.slice(bee.target.length - 4);
                Apiary.logger.resourceTransfer(this.hive.roomName, ref, bee.store, ss.store, res, 1);
              }
          }

          if (!bee.store.getUsedCapacity()) {
            bee.state = beeStates.chill;
            bee.target = undefined;
          } else
            break;

        case beeStates.chill:
          bee.goRest(this.cell.pos, { offRoad: true });
      }
      if (this.checkFlee(bee) && bee.targetPosition && bee.hits < bee.hitsMax) {
        let diff = bee.store.getUsedCapacity() - Math.floor(bee.store.getCapacity() * 0.5 + 50);
        if (diff > 0)
          bee.drop(findOptimalResource(bee.store), diff);
      }
    });
  }
}
