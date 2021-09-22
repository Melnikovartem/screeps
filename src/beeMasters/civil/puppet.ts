import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";

@profile
export class PuppetMaster extends SwarmMaster {

  update() {
    super.update();
    if (this.checkBees()) {
      this.wish({
        setup: setups.puppet,
        amount: 1,
        priority: 2, // well it is cheap -_-
      });
    }
  }

  run() {
    _.forEach(this.activeBees, (bee) => bee.goRest(this.order.pos));
  }
}
