import { Setups } from "../../creepSetups"
import { SwarmMaster } from "../_SwarmMaster";
import type { SpawnOrder } from "../../Hive";
import { profile } from "../../profiler/decorator";

@profile
export class puppetMaster extends SwarmMaster {

  update() {
    super.update();
    if (this.checkBees()) {
      let order: SpawnOrder = {
        setup: Setups.puppet,
        amount: 1,
        priority: 2, // well it is cheap -_-
      };

      this.wish(order);
    }

    if (this.beesAmount === 0 && !this.waitingForBees && this.spawned === this.maxSpawns)
      this.order.delete();
  }

  run() {
    _.forEach(this.bees, (bee) => {
      Apiary.intel.getInfo(bee.pos.roomName, 50); // get intel for stuff
      bee.goRest(this.order.pos);
    });
  }
}
