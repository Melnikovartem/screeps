import { Setups } from "../../bees/creepSetups";
import { SwarmMaster } from "../_SwarmMaster";

import { profile } from "../../profiler/decorator";

// this will become outdated soon

@profile
export class portalMaster extends SwarmMaster {
  maxSpawns = Infinity;

  update() {
    super.update();

    if (Game.time >= this.oldestSpawn + CREEP_LIFE_TIME - 100) {
      this.wish({
        setup: Setups.puppet,
        amount: 1,
        priority: 2, // well it is cheap -_-
      });
    }
  }

  run() {
    _.forEach(this.activeBees, (bee) => {
      bee.goTo(this.order.pos, { preferHighway: true });
    });
  }
}
