import { Master } from "../_Master";

import { beeStates, hiveStates } from "../../enums";
import { setups } from "../../bees/creepsetups";
import { findOptimalResource } from "../../abstract/utils"

import { profile } from "../../profiler/decorator";
import type { ExcavationCell } from "../../cells/base/excavationCell";

@profile
export class HaulerMaster extends Master {
  cell: ExcavationCell;
  targetMap: { [id: string]: { beeRef: string, resource: ResourceConstant } | undefined } = {};
  roadUpkeepCost: { [id: string]: number } = {};
  accumRoadTime = 0;
  dropOff: StructureStorage // | StructureContainer | StructureLink;

  constructor(excavationCell: ExcavationCell, storage: StructureStorage) {
    super(excavationCell.hive, excavationCell.ref);
    this.cell = excavationCell;
    this.dropOff = storage;
  }

  deleteBee(ref: string) {
    super.deleteBee(ref);
    delete this.roadUpkeepCost[ref];
  }

  recalculateRoadTime() {
    this.accumRoadTime = 0; // roadTime * minePotential
    if (this.hive.cells.storage)
      _.forEach(this.cell.resourceCells, cell => {
        if (cell.operational && cell.roadTime !== Infinity && cell.container && !cell.link && (!this.hive.cells.dev || cell.resourceType !== RESOURCE_ENERGY)) {
          let coef = 10; // mineral production
          if (cell.resourceType !== RESOURCE_ENERGY) {
            let body = setups.miner.minerals.getBody(this.hive.room.energyCapacityAvailable).body;
            coef = body.filter(b => b === WORK).length / 5;
          }
          this.accumRoadTime += cell.roadTime * coef;
        }
      });
    this.cell.shouldRecalc = false;
  }

  recalculateTargetBee() {
    let body = setups.hauler.getBody(this.hive.room.energyCapacityAvailable).body;
    this.cell.fullContainer = Math.min(CONTAINER_CAPACITY * 0.9, body.filter(b => b === CARRY).length * CARRY_CAPACITY)
    this.targetBeeCount = Math.ceil(this.accumRoadTime / this.cell.fullContainer);
  }

  checkBeesWithRecalc() {
    let check = () => this.checkBees(hiveStates.battle !== this.hive.state);
    if (!check())
      return false;
    this.recalculateTargetBee();
    return check();
  }

  update() {
    super.update();

    if ((<Store<ResourceConstant, false>>this.dropOff.store).getFreeCapacity() <= 0)
      return;

    _.forEach(this.cell.quitefullCells, cell => {
      let container = cell.container;
      if (!container)
        return;

      let target = this.targetMap[container.id];
      if (target && Apiary.bees[target.beeRef])
        return;

      let bee = container.pos.findClosest(_.filter(this.activeBees, b => b.state === beeStates.chill
        && b.creep.ticksToLive && b.creep.ticksToLive >= cell.roadTime));
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
        amount: this.targetBeeCount - this.beesAmount,
        priority: 6,
      });
    }
  }

  run() {
    _.forEach(this.activeBees, bee => {
      if (bee.state === beeStates.refill && bee.store.getFreeCapacity() === 0)
        bee.state = beeStates.work;
      if (bee.state === beeStates.chill && bee.store.getUsedCapacity() > 0)
        bee.state = beeStates.work;

      if (bee.state === beeStates.work) {
        let res: ResourceConstant = RESOURCE_ENERGY;

        if (bee.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && bee.repairRoadOnMove() === OK)
          this.roadUpkeepCost[bee.ref]++;

        if (bee.pos.isNearTo(this.dropOff))
          res = findOptimalResource(bee.store);
        let ans = bee.transfer(this.dropOff, res);

        if (Apiary.logger && ans === OK && bee.target) {
          let ref = "mining_" + bee.target.slice(bee.target.length - 4);
          Apiary.logger.resourceTransfer(this.hive.roomName, ref, bee.store, this.dropOff.store, res, 1);
          if (this.roadUpkeepCost[bee.ref] > 0) {
            Apiary.logger.addResourceStat(this.hive.roomName, ref, this.roadUpkeepCost[bee.ref], RESOURCE_ENERGY);
            Apiary.logger.addResourceStat(this.hive.roomName, "build", -this.roadUpkeepCost[bee.ref], RESOURCE_ENERGY);
          }
        }

        if (bee.store.getUsedCapacity() === 0) {
          bee.state = beeStates.chill;
          delete bee.target;
        }
      }

      if (bee.state === beeStates.refill) {
        if (bee.target && this.targetMap[bee.target]) {
          let target = <StructureContainer | undefined>Game.getObjectById(bee.target);
          if (bee.withdraw(target, this.targetMap[bee.target]!.resource, undefined, { offRoad: true }) === OK) {
            this.targetMap[bee.target] = undefined;
            bee.state = beeStates.work;
            let res: Source | Mineral | null = bee.pos.findClosest(target!.pos.findInRange(FIND_SOURCES, 2));
            if (!res)
              res = bee.pos.findClosest(target!.pos.findInRange(FIND_MINERALS, 2));
            bee.target = res ? res.id : undefined;
          }
        } else
          bee.state = beeStates.chill; //failsafe
      }

      if (bee.state === beeStates.chill)
        bee.goRest(this.cell.pos, { offRoad: true });
    });
  }
}
