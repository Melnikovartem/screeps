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
          if (cell.resourceType != RESOURCE_ENERGY)
            coef = Math.floor(energyCap / 550); // max mineral mining based on current miner setup (workPart * 5) / 5
          accumRoadTime += this.hive.cells.storage!.storage.pos.getTimeForPath(cell.container.pos) * coef * 2;
        }
      });

    //  accumRoadTime/(hauler carry cap / 2) aka desired time for 1 hauler
    this.targetBeeCount = Math.ceil(accumRoadTime / Math.min(Math.floor(energyCap / 150) * 100, 1600));
    this.cell.shouldRecalc = false;
  }

  update() {
    super.update();

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
      if (ans != resourceConstant && store[<ResourceConstant>resourceConstant] > store.getUsedCapacity(ans))
        ans = <ResourceConstant>resourceConstant;
    }
    return ans;
  }

  run() {
    _.forEach(this.cell.quitefullContainers, (container) => {
      let target = this.targetMap[container.id];
      if (target && Apiary.bees[target.beeRef])
        return;

      let bee = container.pos.findClosest(_.filter(this.bees, (b) => b.state == states.chill));
      if (bee) {
        bee.state = states.refill;
        bee.target = container.id;
        this.targetMap[container.id] = {
          beeRef: bee.ref,
          resource: this.findOptimalResource(container.store),
        };
      }
    });

    _.forEach(this.bees, (bee) => {
      if (bee.state == states.refill && bee.store.getFreeCapacity() == 0)
        bee.state = states.work;
      if (bee.state == states.chill && bee.store.getUsedCapacity() > 0)
        bee.state = states.work;

      if (bee.state == states.work) {
        let res: ResourceConstant = RESOURCE_ENERGY;

        if (bee.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
          bee.repairRoadOnMove();

        if (bee.pos.isNearTo(this.cell.dropOff))
          res = this.findOptimalResource(bee.store);
        let ans = bee.transfer(this.cell.dropOff, res);

        if (Apiary.logger && ans == OK) {
          let container = Game.getObjectById(bee.target || "");
          let resId = "failed";
          if (container instanceof StructureContainer) {
            let resource = container.pos.findInRange(FIND_SOURCES, 2)[0];
            if (resource)
              resId = resource.id.slice(resource.id.length - 4);
          }
          Apiary.logger.resourceTransfer(this.hive.roomName, "mining_" + resId, bee.store, this.cell.dropOff.store, res, 1);
        }

        if (bee.store.getUsedCapacity() == 0) {
          bee.state = states.chill;
          bee.target = null;
        }
      }

      if (bee.state == states.refill) {
        if (bee.target && this.targetMap[bee.target]) {
          let target = <StructureContainer | undefined>Game.getObjectById(bee.target);
          if (bee.withdraw(target, this.targetMap[bee.target]!.resource, undefined, { offRoad: true }) == OK) {
            this.targetMap[bee.target] = undefined;
            bee.state = states.work;
          }
        } else
          bee.state = states.chill; //failsafe
      }

      if (bee.state == states.chill)
        bee.goRest(this.cell.pos, { offRoad: true });
    });
  }
}
