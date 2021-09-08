// refills the respawnCell
import { excavationCell } from "../../cells/stage1/excavationCell";

import { Setups } from "../../creepSetups";
import { SpawnOrder } from "../../Hive";
import { Master, states } from "../_Master";
import { profile } from "../../profiler/decorator";

@profile
export class haulerMaster extends Master {
  cell: excavationCell;
  targetMap: { [id: string]: { beeRef: string, resource: ResourceConstant } | undefined } = {};
  roadUpkeepCost: { [id: string]: number } = {};

  constructor(excavationCell: excavationCell) {
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

      let bee = container.pos.findClosest(_.filter(this.bees, (b) => b.state === states.chill && Game.time - b.memory.born > 100));
      if (bee) {
        bee.state = states.refill;
        bee.target = container.id;
        this.roadUpkeepCost[bee.ref] = 0;
        this.targetMap[container.id] = {
          beeRef: bee.ref,
          resource: this.findOptimalResource(container.store),
        };
      }
    });

    if (this.cell.shouldRecalc)
      this.recalculateTargetBee();

    if (this.checkBees()) {
      let order: SpawnOrder = {
        setup: Setups.hauler,
        amount: Math.max(1, this.targetBeeCount - this.beesAmount),
        priority: 6,
      };

      this.wish(order);
    }
  }

  findOptimalResource(store: Store<ResourceConstant, false>): ResourceConstant {
    let ans: ResourceConstant = RESOURCE_ENERGY;
    for (let resourceConstant in store) {
      if (ans !== resourceConstant && store[<ResourceConstant>resourceConstant] > store.getUsedCapacity(ans))
        ans = <ResourceConstant>resourceConstant;
    }
    return ans;
  }

  run() {
    _.forEach(this.bees, (bee) => {
      if (bee.state === states.refill && bee.store.getFreeCapacity() === 0)
        bee.state = states.work;
      if (bee.state === states.chill && bee.store.getUsedCapacity() > 0)
        bee.state = states.work;

      if (bee.state === states.work) {
        let res: ResourceConstant = RESOURCE_ENERGY;

        if (bee.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
          if (bee.repairRoadOnMove() === OK)
            this.roadUpkeepCost[bee.ref]++;

        if (bee.pos.isNearTo(this.cell.dropOff))
          res = this.findOptimalResource(bee.store);
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
          bee.state = states.chill;
          bee.target = null;
        }
      }

      if (bee.state === states.refill) {
        if (bee.target && this.targetMap[bee.target]) {
          let target = <StructureContainer | undefined>Game.getObjectById(bee.target);
          if (bee.withdraw(target, this.targetMap[bee.target]!.resource, undefined, { offRoad: true }) === OK) {
            this.targetMap[bee.target] = undefined;
            bee.state = states.work;
            let res: Source | Mineral | null = bee.pos.findClosest(target!.pos.findInRange(FIND_SOURCES, 2));
            if (!res)
              res = bee.pos.findClosest(target!.pos.findInRange(FIND_MINERALS, 2));
            bee.target = res ? res.id : null;
          }
        } else
          bee.state = states.chill; //failsafe
      }

      if (bee.state === states.chill)
        bee.goRest(this.cell.pos, { offRoad: true });
    });
  }
}
