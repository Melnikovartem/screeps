import { Master } from "../_Master";

import { beeStates } from "../../enums";
import { setups } from "../../bees/creepsetups";
import { findOptimalResource } from "../../abstract/utils"

import { profile } from "../../profiler/decorator";
import type { ExcavationCell } from "../../cells/stage1/excavationCell";

@profile
export class HaulerMaster extends Master {
  cell: ExcavationCell;
  targetMap: { [id: string]: { beeRef: string, resource: ResourceConstant } | undefined } = {};
  roadUpkeepCost: { [id: string]: number } = {};

  constructor(excavationCell: ExcavationCell) {
    super(excavationCell.hive, excavationCell.ref);

    this.cell = excavationCell;
  }

  recalculateTargetBee() {
    let accumRoadTime = 0; // roadTime * minePotential
    let energyCap = this.hive.room.energyCapacityAvailable;
    if (this.hive.cells.storage)
      _.forEach(this.cell.resourceCells, (cell) => {
        if (cell.container && !cell.link) {
          let coef = 10; // mineral production
          if (cell.resourceType !== RESOURCE_ENERGY)
            coef = Math.floor(energyCap / 550); // max mineral mining based on current miner setup (workPart * 5) / 5
          accumRoadTime += this.hive.cells.storage!.storage.pos.getTimeForPath(cell.container.pos) * coef * 2;
        }
      });

    //  accumRoadTime/(hauler carry cap / 2) aka desired time for 1 hauler
    this.targetBeeCount = Math.ceil(accumRoadTime / Math.min(Math.floor(energyCap / 150) * 100, 1600));
    this.cell.shouldRecalc = false;
  }

  deleteBee(ref: string) {
    super.deleteBee(ref);
    delete this.roadUpkeepCost[ref];
  }

  update() {
    super.update();

    if ((<Store<ResourceConstant, false>>this.cell.dropOff.store).getFreeCapacity() <= 0)
      return;

    _.forEach(this.cell.quitefullContainers, (container) => {
      let target = this.targetMap[container.id];
      if (target && Apiary.bees[target.beeRef])
        return;

      let bee = container.pos.findClosest(_.filter(this.bees, (b) => b.state === beeStates.chill && Game.time - b.memory.born > 100));
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

    if (this.cell.shouldRecalc)
      this.recalculateTargetBee();

    if (this.checkBees()) {
      this.wish({
        setup: setups.hauler,
        amount: 1,
        priority: 6,
      });
    }
  }

  run() {
    _.forEach(this.activeBees, (bee) => {
      if (bee.state === beeStates.refill && bee.store.getFreeCapacity() === 0)
        bee.state = beeStates.work;
      if (bee.state === beeStates.chill && bee.store.getUsedCapacity() > 0)
        bee.state = beeStates.work;

      if (bee.state === beeStates.work) {
        let res: ResourceConstant = RESOURCE_ENERGY;

        if (bee.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && bee.repairRoadOnMove() === OK)
          this.roadUpkeepCost[bee.ref]++;

        if (bee.pos.isNearTo(this.cell.dropOff))
          res = findOptimalResource(bee.store);
        let ans = bee.transfer(this.cell.dropOff, res);

        if (Apiary.logger && ans === OK && bee.target) {
          let ref = "mining_" + bee.target.slice(bee.target.length - 4);
          Apiary.logger.resourceTransfer(this.hive.roomName, ref, bee.store, this.cell.dropOff.store, res, 1);
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
