import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";

@profile
export class PuppetMaster extends SwarmMaster {
  movePriority = <5>5;

  update() {
    super.update();
    if (this.checkBees()) {
      this.wish({
        setup: this.order.ref.includes(CLAIM) ? setups.claimer : setups.puppet,
        priority: 2, // well it is mostly cheap -_-
      });
    }
  }

  run() {
    _.forEach(this.activeBees, bee => bee.goRest(this.order.pos));
  }
}
