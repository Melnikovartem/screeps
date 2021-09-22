import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";
import type { SpawnOrder } from "../../Hive";

//first tandem btw
@profile
export class WaiterMaster extends SwarmMaster {

  update() {
    super.update();
    if (this.checkBees()) {
      let healerOrder: SpawnOrder = {
        setup: setups.healer,
        amount: 1,
        priority: 4,
        master: this.ref,
      };
      this.wish(healerOrder, this.ref + "_healer");
    }
  }

  run() {
    _.forEach(this.activeBees, (bee) => {
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
