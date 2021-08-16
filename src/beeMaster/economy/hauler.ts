// refills the respawnCell
import { excavationCell } from "../../cells/stage1/excavationCell";

import { Setups } from "../../creepSetups";
import { SpawnOrder } from "../../Hive";
import { Master } from "../_Master";
import { profile } from "../../profiler/decorator";

@profile
export class haulerMaster extends Master {
  cell: excavationCell;
  targetMap: { [id: string]: string } = {}; // "" is base value

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
          this.targetMap[cell.container.id] = "";
          let coef = 10;
          if (cell.resourceType != RESOURCE_ENERGY)
            coef = Math.floor(energyCap / 550); // max mineral mining based on current miner setup
          accumRoadTime += this.hive.cells.storage!.storage.pos.getTimeForPath(cell.container.pos) * coef;
        }
      });

    //  accumRoadTime/(hauler carry cap / 2) aka desired time for 1 hauler
    this.targetBeeCount = Math.ceil(accumRoadTime / (Math.min(Math.ceil(energyCap / 150) * 100, 1600) / 2));
  }

  update() {
    super.update();

    for (let key in this.targetMap) {
      if (!Apiary.bees[this.targetMap[key]])
        this.targetMap[key] = "";
    }

    if (this.checkBees()) {
      let order: SpawnOrder = {
        master: this.ref,
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
      if (ans != resourceConstant && store[<ResourceConstant>resourceConstant] > store[ans])
        ans = <ResourceConstant>resourceConstant;
    }
    return ans;
  }

  run() {
    // for future might be good to find closest bee for container and not the other way around
    if (this.hive.cells.storage) {
      let storage = this.hive.cells.storage.storage;
      _.forEach(this.bees, (bee) => {
        let ans;

        if (bee.creep.store.getUsedCapacity() == 0) {
          let suckerTarget: StructureContainer = _.filter(this.cell.quitefullContainers,
            (container) => this.targetMap[container.id] == bee.ref)[0];

          if (!suckerTarget)
            suckerTarget = <StructureContainer>_.filter(this.cell.quitefullContainers,
              (container) => this.targetMap[container.id] == "")[0];

          if (suckerTarget) {
            ans = bee.withdraw(suckerTarget, this.findOptimalResource(suckerTarget.store))
            if (ans == OK)
              this.targetMap[suckerTarget.id] = "";
            else
              this.targetMap[suckerTarget.id] = bee.ref;
          } else
            bee.goRest(this.cell.pos);
        }

        if ((bee.creep.store.getUsedCapacity() > 0 || ans == OK)) {
          if (storage.store.getFreeCapacity() > 0)
            bee.transfer(storage, this.findOptimalResource(bee.store));
          else
            bee.goRest(this.cell.pos);
        }
      });
    }
  }
}
