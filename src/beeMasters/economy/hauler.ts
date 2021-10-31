import { Master } from "../_Master";

import { beeStates, hiveStates } from "../../enums";
import { setups } from "../../bees/creepsetups";
import { findOptimalResource } from "../../abstract/utils"

import { profile } from "../../profiler/decorator";
import type { ExcavationCell } from "../../cells/base/excavationCell";
import type { Bee } from "../../bees/bee";

@profile
export class HaulerMaster extends Master {
  cell: ExcavationCell;
  targetMap: { [id: string]: { beeRef: string, resource: ResourceConstant } | undefined } = {};
  roadUpkeepCost: { [id: string]: number } = {};
  accumRoadTime = 0;
  dropOff: StructureStorage | StructureTerminal; // | StructureContainer | StructureLink;

  constructor(excavationCell: ExcavationCell, storage: StructureStorage | StructureTerminal) {
    super(excavationCell.hive, excavationCell.ref);
    this.cell = excavationCell;
    this.dropOff = storage;
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
    if (this.hive.cells.storage)
      _.forEach(this.cell.resourceCells, cell => {
        if (cell.operational && cell.roadTime !== Infinity && cell.restTime !== Infinity && cell.container && !cell.link) {
          let coef = Math.min(cell.master.getBeeRate(), cell.ratePT);
          this.accumRoadTime += (cell.roadTime + cell.restTime) * coef;
        }
      });
    this.cell.shouldRecalc = false;
  }

  recalculateTargetBee() {
    if (!this.accumRoadTime) {
      this.targetBeeCount = 0;
      return;
    }
    let body = setups.hauler.getBody(this.hive.room.energyCapacityAvailable).body;
    this.cell.fullContainer = Math.min(CONTAINER_CAPACITY, body.filter(b => b === CARRY).length * CARRY_CAPACITY);
    let rounding = (x: number) => Math.max(1, Math.ceil(x - 0.15));
    if (this.hive.state === hiveStates.lowenergy)
      rounding = x => Math.max(1, Math.floor(x));
    this.targetBeeCount = rounding(this.accumRoadTime / this.cell.fullContainer);
  }

  checkBeesWithRecalc() {
    let check = () => this.checkBees(hiveStates.battle !== this.hive.state || !this.beesAmount);
    if (this.targetBeeCount && !check())
      return false;
    this.recalculateTargetBee();
    return check();
  }

  update() {
    super.update();

    if (this.dropOff.store.getFreeCapacity() <= 0)
      return;

    _.forEach(this.cell.quitefullCells, cell => {
      let container = cell.container;
      if (!container)
        return;

      let target = this.targetMap[container.id];
      let oldBee = target && this.bees[target.beeRef];
      if (oldBee && oldBee.target === container.id)
        return;

      let bee = container.pos.findClosest(_.filter(this.activeBees, b => b.state === beeStates.chill && b.ticksToLive >= cell.roadTime + b.pos.getRangeApprox(cell) + 15));
      if (bee) {
        bee.state = beeStates.refill;
        bee.target = container.id;
        this.roadUpkeepCost[bee.ref] = 0;
        this.targetMap[container.id] = {
          beeRef: bee.ref,
          resource: findOptimalResource(container.store),
        };
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
      let res: ResourceConstant;
      switch (bee.state) {
        case beeStates.refill:
          if (!bee.target || !this.targetMap[bee.target]) {
            bee.state = beeStates.work;
            break;
          }

          let target = <StructureContainer | undefined>Game.getObjectById(bee.target);

          if (!target) {
            bee.target = undefined;
            if (bee.store.getUsedCapacity())
              bee.state = beeStates.work;
            else
              bee.state = beeStates.chill;
            break;
          }

          let roomInfo = Apiary.intel.getInfo(target.pos.roomName, 25);
          if (!roomInfo.safePlace) {
            this.targetMap[bee.target] = undefined;
            bee.state = beeStates.chill;
            break;
          }

          res = this.targetMap[bee.target]!.resource;
          let overproduction;
          if (target && bee.pos.getRangeTo(target) <= 2) {
            overproduction = bee.pos.findInRange(FIND_DROPPED_RESOURCES, 2)[0]; //.filter(r => r.resourceType === res)
            // overproduction or energy from SK defenders
            if (overproduction)
              bee.pickup(overproduction);
          }

          if (!bee.store.getFreeCapacity() || !overproduction && bee.withdraw(target, res, undefined, { offRoad: true }) === OK) {
            this.targetMap[bee.target] = undefined;
            bee.state = beeStates.work;
            let source: Source | Mineral | null = bee.pos.findClosest(target.pos.findInRange(FIND_SOURCES, 1));
            if (!source)
              source = bee.pos.findClosest(target!.pos.findInRange(FIND_MINERALS, 1));
            bee.target = source ? source.id : undefined;
          }
          break;

        case beeStates.work:
          res = findOptimalResource(bee.store);

          if (bee.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && bee.repairRoadOnMove() === OK)
            this.roadUpkeepCost[bee.ref]++;

          let ans = bee.transfer(this.dropOff, res);
          if (ans === OK && Apiary.logger && bee.target) {
            let ref = "mining_" + bee.target.slice(bee.target.length - 4);
            Apiary.logger.resourceTransfer(this.hive.roomName, ref, bee.store, this.dropOff.store, res, 1);
            if (this.roadUpkeepCost[bee.ref] > 0) {
              Apiary.logger.addResourceStat(this.hive.roomName, ref, this.roadUpkeepCost[bee.ref], RESOURCE_ENERGY);
              Apiary.logger.addResourceStat(this.hive.roomName, "build", -this.roadUpkeepCost[bee.ref], RESOURCE_ENERGY);
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
      if (this.checkFlee(bee) && bee.targetPosition) {
        let diff = bee.store.getUsedCapacity() - Math.floor(bee.store.getCapacity() * 0.5 + 50);
        if (diff > 0)
          bee.drop(findOptimalResource(bee.store));
      }
    });
  }
}
