import { Setups } from "../../creepSetups";
import { SwarmMaster } from "../_SwarmMaster";
import type { SpawnOrder } from "../../Hive";
import { profile } from "../../profiler/decorator";

//first tandem btw
@profile
export class waiterMaster extends SwarmMaster {

  update() {
    super.update();
    if (this.checkBeesSwarm()) {
      let healerOrder: SpawnOrder = {
        setup: Setups.healer,
        amount: 1,
        priority: 4,
        master: this.ref,
      };
      this.wish(healerOrder, this.ref + "_healer");
    }
  }

  run() {
    _.forEach(this.bees, (bee) => {
      bee.goRest(this.order.pos);
      let healingTarget = bee.pos.findClosest(_.filter(bee.pos.findInRange(FIND_MY_CREEPS, 3),
        (beeTarget) => beeTarget.hits < beeTarget.hitsMax));
      if (healingTarget) {
        if (bee.pos.isNearTo(healingTarget))
          bee.heal(healingTarget);
        else
          bee.rangedHeal(healingTarget);
      }
    });
  }
}
