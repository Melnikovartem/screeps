import { Setups } from "../../creepSetups";
import { SpawnOrder, Hive } from "../../Hive";
import { Master, states } from "../_Master";
import { profile } from "../../profiler/decorator";

@profile
export class builderMaster extends Master {

  constructor(hive: Hive) {
    super(hive, "BuilderHive_" + hive.room.name);
  }

  update() {
    super.update();

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

        setup: Setups.builder,
        amount: this.targetBeeCount - this.beesAmount,
        priority: 8,
      };

      this.wish(order);
    }
  }

  run() {
    _.forEach(this.bees, (bee) => {
      if (bee.creep.store[RESOURCE_ENERGY] == 0)
        bee.state = states.refill;
      else
        bee.state = states.work;

      if (bee.state == states.refill
        && bee.withdraw(this.hive.cells.storage && this.hive.cells.storage.storage, RESOURCE_ENERGY) == OK)
        bee.state = states.work;

      if (bee.state == states.work) {
        let target: Structure | ConstructionSite | null = null;

        if (bee.target) {
          target = Game.getObjectById(bee.target);
          if (target instanceof Structure && target.hits == target.hitsMax) {
            this.hive.shouldRecalc = true;
            target = null;
          }
        }

        if (!target)
          target = bee.pos.findClosest(this.hive.emergencyRepairs);
        if (!target)
          target = bee.pos.findClosest(this.hive.constructionSites);
        if (!target)
          target = bee.pos.findClosest(this.hive.normalRepairs);

        if (target) {
          let ans;
          if (target instanceof ConstructionSite)
            ans = bee.build(target);
          else if (target instanceof Structure)
            ans = bee.repair(target);
          bee.target = target.id;
          if (ans == ERR_NOT_IN_RANGE)
            bee.repair(_.filter(bee.pos.lookFor(LOOK_STRUCTURES), (s) => s.hits < s.hitsMax)[0]);
        } else {
          bee.target = null;
          bee.state = states.chill;
        }
      }

      if (bee.state == states.chill)
        bee.goRest(this.hive.pos);
    });
  }
}
