// manages the storage if needed
// like from storage to link or terminal
// refill towers?
// refills the respawnCell
import { storageCell } from "../cells/storageCell";

import { Setups } from "../creepSetups";

import { spawnOrder } from "../Hive";
import { Bee } from "../Bee";
import { Master } from "./_Master";

export class managerMaster extends Master {
  managers: Bee[] = [];
  lastSpawned: number;

  storage: StructureStorage;
  link: StructureLink | undefined;
  targets: (StructureLink | StructureTower)[] = []; //idk what else for now

  constructor(storageCell: storageCell) {
    super(storageCell.hive, "master_" + storageCell.ref);

    this.storage = storageCell.storage;

    this.link = storageCell.link;
    if (this.link)
      this.targets.push(this.link);


    this.targets = this.targets.concat(this.hive.towers);


    this.lastSpawned = Game.time - CREEP_LIFE_TIME;
    this.refreshLastSpawned();

    this.updateCash(['targets']);
  }

  newBee(bee: Bee): void {
    this.managers.push(bee);
    this.refreshLastSpawned();
  }

  refreshLastSpawned(): void {
    _.forEach(this.managers, (bee) => {
      if (bee.creep.ticksToLive && Game.time - bee.creep.ticksToLive >= this.lastSpawned)
        this.lastSpawned = Game.time - bee.creep.ticksToLive;
    });
  }

  update() {
    // 5 for random shit
    // tragets.length cause dont need a manager for nothing
    if (Game.time + 5 >= this.lastSpawned + CREEP_LIFE_TIME && this.targets.length > 0) {
      let order: spawnOrder = {
        master: this.ref,
        setup: Setups.manager.normal,
        amount: 1,
      };

      this.lastSpawned = Game.time;
      this.hive.wish(order);
    }
  };

  run() {
    _.forEach(this.managers, (bee) => {
      let target;
      if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {

        target = _.filter(this.targets, (structure) => structure.structureType == STRUCTURE_TOWER &&
          structure.store.getCapacity(RESOURCE_ENERGY) * 0.75 >= structure.store.getUsedCapacity(RESOURCE_ENERGY))[0];

        if (!target)
          target = _.filter(this.targets, (structure) => structure.structureType == STRUCTURE_LINK &&
            structure.store.getCapacity(RESOURCE_ENERGY) * 0.5 >= structure.store.getUsedCapacity(RESOURCE_ENERGY))[0];

        if (!target)
          target = _.filter(this.targets, (structure) => structure.structureType == STRUCTURE_TOWER &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0)[0];

        if (!target && this.link && this.link.store.getUsedCapacity(RESOURCE_ENERGY) >= this.link.store.getCapacity(RESOURCE_ENERGY) * 0.5)
          target = this.storage;

        if (target)
          bee.transfer(target, RESOURCE_ENERGY);
      }

      if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0 || !target) {
        let suckerTarget;
        let amount = bee.creep.store.getFreeCapacity(RESOURCE_ENERGY);

        if (!suckerTarget && this.link && this.link.store.getUsedCapacity(RESOURCE_ENERGY) >= this.link.store.getCapacity(RESOURCE_ENERGY) * 0.5) {
          suckerTarget = this.link;
          amount = Math.min(amount, this.link.store.getUsedCapacity(RESOURCE_ENERGY) - this.link.store.getCapacity(RESOURCE_ENERGY) * 0.5);
        }

        if (!suckerTarget) {
          suckerTarget = this.storage;
          amount = Math.min(amount, this.storage.store.getUsedCapacity(RESOURCE_ENERGY));
        }

        if (suckerTarget)
          bee.withdraw(suckerTarget, RESOURCE_ENERGY, amount);
      }
    });
  };
}
