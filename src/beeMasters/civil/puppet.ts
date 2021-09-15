import { Setups } from "../../bees/creepSetups"
import { SwarmMaster } from "../_SwarmMaster";
import { profile } from "../../profiler/decorator";

@profile
export class puppetMaster extends SwarmMaster {

  update() {
    super.update();
    if (this.checkBees()) {
      this.wish({
        setup: Setups.puppet,
        amount: 1,
        priority: 2, // well it is cheap -_-
      });
    }
  }

  run() {
    _.forEach(this.activeBees, (bee) => {
      Apiary.intel.getInfo(bee.pos.roomName, 50); // get intel for stuff
      bee.goRest(this.order.pos);
    });
  }
}
