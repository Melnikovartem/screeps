import { Setups } from "../../creepSetups";
import { SpawnOrder, Hive } from "../../Hive";
import { Master } from "../_Master";
import { profile } from "../../profiler/decorator";

@profile
export class builderMaster extends Master {
  targetCaching: { [id: string]: string } = {};

  constructor(hive: Hive) {
    super(hive, "BuilderHive_" + hive.room.name);
  }

  update() {
    super.update();

    // TODO smarter counting of builders needed
    let storage = this.hive.cells.storage && this.hive.cells.storage.storage;
    if ((this.hive.emergencyRepairs.length * 0.5 + this.hive.constructionSites.length >= 22)
      && storage && storage.store[RESOURCE_ENERGY] > 200000)
      this.targetBeeCount = 3;
    else if ((this.hive.emergencyRepairs.length * 0.5 + this.hive.constructionSites.length >= 6)
      && storage && storage.store[RESOURCE_ENERGY] > 100000)
      this.targetBeeCount = 2;
    else if (this.hive.emergencyRepairs.length * 0.5 + this.hive.constructionSites.length >= 1.5)
      this.targetBeeCount = 1;
    else
      this.targetBeeCount = 0;

    if (this.checkBees()) {
      let order: SpawnOrder = {
        master: this.ref,
        setup: Setups.builder,
        amount: this.targetBeeCount - this.beesAmount,
        priority: 8,
      };

      this.wish(order);
    }
  }

  run() {
    let storage = this.hive.cells.storage && this.hive.cells.storage.storage;
    _.forEach(this.bees, (bee) => {
      let ans: number = ERR_FULL;
      if (bee.creep.store[RESOURCE_ENERGY] == 0 && storage) {
        ans = bee.withdraw(storage, RESOURCE_ENERGY);
        this.targetCaching[bee.ref] = "";
      }

      if (bee.creep.store[RESOURCE_ENERGY] > 0 || ans == OK) {
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
        } else
          bee.goRest(this.hive.pos);
      }
    });
  }
}
