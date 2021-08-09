// manages the storage if needed
// like from storage to link or terminal
// refill towers?
// refills the respawnCell
import { storageCell } from "../../cells/storageCell";

import { Setups } from "../../creepSetups";

import { spawnOrder } from "../../Hive";
import { Bee } from "../../Bee";
import { Master } from "../_Master";

export class managerMaster extends Master {
  managers: Bee[] = [];
  lastSpawned: number;

  cell: storageCell;

  targets: (StructureTower | StructureLink | StructureStorage)[] = [];
  suckerTargets: (StructureStorage | StructureLink)[] = [];

  constructor(storageCell: storageCell) {
    super(storageCell.hive, "master_" + storageCell.ref);

    this.cell = storageCell;

    this.lastSpawned = Game.time - CREEP_LIFE_TIME;
  }

  newBee(bee: Bee): void {
    this.managers.push(bee);
    this.refreshLastSpawned();
  }

  refreshLastSpawned(): void {
    _.forEach(this.managers, (bee) => {
      let ticksToLive: number = bee.creep.ticksToLive ? bee.creep.ticksToLive : CREEP_LIFE_TIME;
      if (Game.time - (CREEP_LIFE_TIME - ticksToLive) >= this.lastSpawned)
        this.lastSpawned = Game.time - (CREEP_LIFE_TIME - ticksToLive);
    });
  }

  update() {
    this.managers = this.clearBees(this.managers);

    this.targets = [];
    this.suckerTargets = [this.cell.storage];

    if (this.hive.cells.defenseCell && this.hive.cells.defenseCell.towers.length)
      this.targets = this.targets.concat(this.hive.cells.defenseCell.towers);

    //if you don't need to withdraw => then it is not enough
    if (this.cell.link) {
      if (this.cell.link.store.getUsedCapacity(RESOURCE_ENERGY) > this.cell.inLink) {
        this.targets.push(this.cell.storage);
        this.suckerTargets.push(this.cell.link);
      }
      else if (this.cell.inLink > this.cell.link.store.getUsedCapacity(RESOURCE_ENERGY))
        this.targets.push(this.cell.link);
    }

    // tragets.length cause dont need a manager for nothing
    if (Game.time >= this.lastSpawned + CREEP_LIFE_TIME && this.targets.length > 0) {
      let order: spawnOrder = {
        master: this.ref,
        setup: Setups.manager,
        amount: 1,
        priority: 3,
      };

      this.lastSpawned = Game.time;
      this.hive.wish(order);
    }
  }

  run() {
    // TODO smarter choosing of target
    // aka draw energy if there is a target and otherwise put it back
    _.forEach(this.managers, (bee) => {
      let ans;
      if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
        let suckerTarget;

        if (!suckerTarget)
          suckerTarget = _.filter(this.suckerTargets, (structure) => structure.structureType == STRUCTURE_LINK &&
            structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0 &&
            structure.store.getUsedCapacity(RESOURCE_ENERGY) - this.cell.inLink >= 25)[0];

        if (!suckerTarget)
          suckerTarget = _.filter(this.suckerTargets, (structure) => structure.structureType == STRUCTURE_STORAGE)[0];

        if (suckerTarget) {
          if (suckerTarget instanceof StructureLink)
            ans = bee.withdraw(suckerTarget, RESOURCE_ENERGY, Math.min(bee.creep.store.getFreeCapacity(RESOURCE_ENERGY),
              suckerTarget.store.getUsedCapacity(RESOURCE_ENERGY) - this.cell.inLink));
          else
            ans = bee.withdraw(suckerTarget, RESOURCE_ENERGY);
        }
      }

      if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 || ans == OK) {
        let target = _.filter(this.targets, (structure) => structure.structureType == STRUCTURE_TOWER &&
          structure.store.getCapacity(RESOURCE_ENERGY) * 0.75 >= structure.store.getUsedCapacity(RESOURCE_ENERGY))[0];

        if (!target)
          target = _.filter(this.targets, (structure) => structure.structureType == STRUCTURE_LINK &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
            (this.cell.inLink - structure.store.getUsedCapacity(RESOURCE_ENERGY) >= 25
              || this.cell.inLink == structure.store.getCapacity(RESOURCE_ENERGY)))[0];

        if (!target)
          target = _.filter(this.targets, (structure) => structure.structureType == STRUCTURE_TOWER &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0)[0];

        if (!target)
          target = _.filter(this.targets, (structure) => structure.structureType == STRUCTURE_STORAGE &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0)[0]

        if (target)
          if (target instanceof StructureLink)
            ans = bee.transfer(target, RESOURCE_ENERGY, Math.min(bee.creep.store.getUsedCapacity(RESOURCE_ENERGY),
              this.cell.inLink - target.store.getUsedCapacity(RESOURCE_ENERGY)));
          else
            bee.transfer(target, RESOURCE_ENERGY);
      }
    });
  }
}
