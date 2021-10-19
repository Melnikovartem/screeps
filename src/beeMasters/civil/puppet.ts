import { SwarmMaster } from "../_SwarmMaster";

import { hiveStates } from "../../enums";
import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";

@profile
export class PuppetMaster extends SwarmMaster {
  movePriority = <5>5;

  update() {
    super.update();
    if (this.checkBees(hiveStates.battle !== this.hive.state)) {
      this.wish({
        setup: setups.puppet,
        priority: 2, // well it is mostly cheap -_-
      });
    }
  }

  run() {
    _.forEach(this.activeBees, bee => bee.goRest(this.order.pos));
  }
}
