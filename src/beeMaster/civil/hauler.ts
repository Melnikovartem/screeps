// refills the respawnCell
import { excavationCell } from "../../cells/excavationCell";

import { Setups } from "../../creepSetups";

import { spawnOrder } from "../../Hive";
import { Bee } from "../../Bee";
import { Master } from "../_Master";

export class haulerMaster extends Master {
  haulers: Bee[] = [];

  cell: excavationCell;

  targetBeeCount: number;
  waitingForABee: number = 0;

  targetMap: { [id: string]: string | null } = {};

  constructor(excavationCell: excavationCell) {
    super(excavationCell.hive, "master_" + excavationCell.ref);

    this.cell = excavationCell;

    this.targetBeeCount = 0
    _.forEach(this.cell.resourceCells, (cell) => {
      let beeForSource = 0;
      if (cell.container) {
        this.targetMap[cell.container.id] = null;
        if (this.hive.stage == 2)
          beeForSource += 0.38;
        else
          beeForSource += 0.55;
      }
      if (cell.link)
        beeForSource = 0;
      this.targetBeeCount += beeForSource;
    });

    this.targetBeeCount = Math.ceil(this.targetBeeCount);
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
        priority: 4,
      };

      if (this.hive.stage < 2)
        order.setup.bodySetup.patternLimit = 10;

      this.waitingForABee += this.targetBeeCount - this.haulers.length;

      this.hive.wish(order);
    }
  }

  run() {
    // for future might be good to find closest bee for container and not the other way around
    if (this.hive.cells.storageCell) {
      let target = this.hive.cells.storageCell.storage;
      _.forEach(this.haulers, (bee) => {
        let ans;

        if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
          let suckerTarget = _.filter(this.cell.quitefullContainers,
            (container) => this.targetMap[container.id] == bee.ref)[0];

          if (!suckerTarget)
            suckerTarget = <StructureContainer>_.filter(this.cell.quitefullContainers,
              (container) => this.targetMap[container.id] == null)[0];

          if (suckerTarget) {
            ans = bee.withdraw(suckerTarget, RESOURCE_ENERGY)
            if (ans == OK)
              this.targetMap[suckerTarget.id] = null;
            else
              this.targetMap[suckerTarget.id] = bee.ref;
          }
        }

        if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 || ans == OK) {
          bee.transfer(target, RESOURCE_ENERGY);
        }
      });
    }
  }
}
