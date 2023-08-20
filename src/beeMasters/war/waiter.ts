import { setups } from "../../bees/creepSetups";
import { profile } from "../../profiler/decorator";
import { SwarmMaster } from "../_SwarmMaster";

// first tandem btw
@profile
export class WaiterMaster extends SwarmMaster {
  update() {
    super.update();
    if (this.checkBees()) {
      this.wish(
        {
          setup: setups.healer,
          priority: 4,
        },
        this.ref + "_healer"
      );
    }
  }

  run() {
    _.forEach(this.activeBees, (bee) => {
      bee.goRest(this.pos);
      const healingTarget = bee.pos.findClosest(
        _.filter(
          bee.pos.findInRange(FIND_MY_CREEPS, 3),
          (beeTarget) => beeTarget.hits < beeTarget.hitsMax
        )
      );
      if (healingTarget) {
        if (bee.pos.isNearTo(healingTarget)) bee.heal(healingTarget);
        else bee.rangedHeal(healingTarget);
      }
    });
  }
}
