import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";

@profile
export class PuppetMaster extends SwarmMaster {
  movePriority = <5>5;

  update() {
    super.update();
    console.log(this.beesAmount, this.spawned, this.maxSpawns);
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
