import { Setups } from "../../creepSetups";
import { SpawnOrder, Hive } from "../../Hive";
import { Master } from "../_Master";

export class builderMaster extends Master {
  targetCaching: { [id: string]: string } = {};

  constructor(hive: Hive) {
    super(hive, "master_" + "builderHive_" + hive.room.name);
  }

  update() {
    super.update();

    // TODO smarter counting of builders needed
    let targetsNumber = this.hive.emergencyRepairs.length + this.hive.constructionSites.length;
    if (targetsNumber > 5 && this.hive.cells.storageCell
      && this.hive.cells.storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 100000) {
      this.targetBeeCount = 2;
    } else {
      this.targetBeeCount = 1;
    }

    if (this.checkBees() && targetsNumber) {
      let order: SpawnOrder = {
        master: this.ref,
        setup: Setups.builder,
        amount: Math.max(1, this.targetBeeCount - this.beesAmount),
        priority: 4,
      };

      this.wish(order);
    }
  }

  run() {
    _.forEach(this.bees, (bee) => {
      let ans: number = ERR_FULL;
      if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0 && this.hive.cells.storageCell) {
        ans = bee.withdraw(this.hive.cells.storageCell.storage, RESOURCE_ENERGY);
        this.targetCaching[bee.ref] = "";
      }

      if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 || ans == OK) {
        let target: Structure | ConstructionSite | null = Game.getObjectById(this.targetCaching[bee.ref]);

        if (target instanceof Structure && target.hits == target.hitsMax)
          target = null;

        if (!target)
          target = bee.pos.findClosest(this.hive.emergencyRepairs);
        if (!target)
          target = bee.pos.findClosest(this.hive.constructionSites);
        if (!target)
          target = bee.pos.findClosest(this.hive.normalRepairs);

        if (target) {
          if (target instanceof ConstructionSite)
            bee.build(target);
          else if (target instanceof Structure)
            bee.repair(target);

          this.targetCaching[bee.ref] = target.id;
        }
      }
    });
  }
}
