// refills the respawnCell
import { excavationCell } from "../cells/excavationCell";

import { Setups } from "../creepSetups";

import { spawnOrder } from "../Hive";
import { Bee } from "../Bee";
import { Master } from "./_Master";

export class haulerMaster extends Master {
  haulers: Bee[] = [];

  cell: excavationCell;

  targetBeeCount: number;
  waitingForABee: number = 0;

  targetMap: { [id: string]: string | null } = {};

  constructor(excavationCell: excavationCell) {
    super(excavationCell.hive, "master_" + excavationCell.ref);

    this.cell = excavationCell;

    _.forEach(this.cell.resourceCells, (cell) => {
      if (cell.container)
        this.targetMap[cell.container.id] = null;
    });

    this.targetBeeCount = Math.ceil(Object.keys(this.targetMap).length / 2);
  }

  newBee(bee: Bee): void {
    this.haulers.push(bee);
    if (this.waitingForABee)
      this.waitingForABee -= 1;
  }

  update() {
    this.haulers = this.clearBees(this.haulers);

    _.forEach(this.targetMap, (ref, key) => {
      if (ref && key && !global.bees[ref])
        this.targetMap[key] = null;
    });

    if (this.haulers.length < this.targetBeeCount && !this.waitingForABee) {
      let order: spawnOrder = {
        master: this.ref,
        setup: Setups.hauler,
        amount: this.targetBeeCount - this.haulers.length,
      };

      this.waitingForABee += this.targetBeeCount - this.haulers.length;

      this.hive.wish(order);
    }
  };

  run() {
    // for future might be good to find closest bee for container and not the other way around
    if (this.hive.cells.storageCell) {
      let target = this.hive.cells.storageCell.storage;
      _.forEach(this.haulers, (bee) => {

        if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
          bee.transfer(target, RESOURCE_ENERGY);
        }

        if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
          let suckerTarget = _.filter(this.cell.quitefullContainers,
            (container) => this.targetMap[container.id] == bee.ref)[0];

          if (!suckerTarget)
            suckerTarget = <StructureContainer>bee.creep.pos.findClosest(
              _.filter(this.cell.quitefullContainers, (container) => this.targetMap[container.id] == null));

          if (suckerTarget) {
            if (bee.withdraw(suckerTarget, RESOURCE_ENERGY) == OK)
              this.targetMap[suckerTarget.id] = null;
            else
              this.targetMap[suckerTarget.id] = bee.ref;
          }
        }
      });
    }
  };
}
