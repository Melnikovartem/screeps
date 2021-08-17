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
    this.recalculateTargetBee();
  }

  recalculateTargetBee() {
    let accumRoadTime = 0; // roadTime * minePotential
    let energyCap = this.hive.room.energyCapacityAvailable
    if (this.hive.cells.storage)
      _.forEach(this.cell.resourceCells, (cell) => {
        if (cell.container && !cell.link) {
          let coef = 12; // mineral production
          if (cell.resourceType != RESOURCE_ENERGY)
            coef = Math.floor(energyCap / 550); // max mineral mining based on current miner setup (workPart * 5) / 5
          accumRoadTime += this.hive.cells.storage!.storage.pos.getTimeForPath(cell.container.pos) * coef * 2;
        }
      });

    //  accumRoadTime/(hauler carry cap / 2) aka desired time for 1 hauler
    this.targetBeeCount = Math.ceil(accumRoadTime / Math.min(Math.floor(energyCap / 150) * 100, 1600));
  }

  update() {
    super.update();

    if (this.checkBees()) {
      let order: SpawnOrder = {
        master: this.ref,
        setup: Setups.hauler,
        amount: Math.max(1, this.targetBeeCount - this.beesAmount),
        priority: 7,
      };

      this.wish(order);
    }
  }

  findOptimalResource(store: Store<ResourceConstant, false>): ResourceConstant {
    let ans: ResourceConstant = RESOURCE_ENERGY;
    for (let resourceConstant in store) {
      if (ans != resourceConstant && store[<ResourceConstant>resourceConstant] > store[ans])
        ans = <ResourceConstant>resourceConstant;
    }
    return ans;
  }

  run() {
    _.forEach(this.cell.quitefullContainers, (container) => {
      let target = this.targetMap[container.id];
      if (target && !Apiary.bees[target.beeRef])
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
        if (bee.store[RESOURCE_ENERGY] > 0)
          bee.repair(_.filter(bee.pos.lookFor(LOOK_STRUCTURES), (s) => s.hits < s.hitsMax)[0]);
        bee.transfer(this.hive.cells.storage && this.hive.cells.storage.storage, <ResourceConstant>Object.keys(bee.store)[0]);
        if (bee.store.getUsedCapacity() == 0)
          bee.state = states.chill;
      }

      if (bee.state == states.refill) {
        if (bee.target && this.targetMap[bee.target]) {
          let target = <StructureContainer | undefined>Game.getObjectById(bee.target);
          if (bee.withdraw(target, this.targetMap[bee.target]!.resource, undefined, { ignoreRoads: true }) == OK) {
            this.targetMap[bee.target] = undefined;
            bee.target = null;
            bee.state = states.work;
          }
        } else
          bee.state = states.chill; //failsafe
      }

      if (bee.state == states.chill)
        bee.goRest(this.cell.pos);
    });
  }
}
