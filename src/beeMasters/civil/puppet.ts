import { setups } from "bees/creepSetups";
import { hiveStates } from "enums";
import { profile } from "profiler/decorator";

import { SwarmMaster } from "../_SwarmMaster";

@profile
export class PuppetMaster extends SwarmMaster {
  movePriority = 5 as const;

  update() {
    super.update();
    if (
      !(this.pos.roomName in Game.rooms) &&
      (this.maxSpawns !== Infinity ||
        this.oldestSpawn + CREEP_LIFE_TIME <= Game.time) && // prevent spam
      this.checkBees(hiveStates.battle !== this.hive.state)
    ) {
      this.wish({
        setup: setups.puppet,
        priority: 2, // well it is mostly cheap -_-
      });
    }
  }

  run() {
    _.forEach(this.activeBees, (bee) => {
      bee.goRest(this.pos, { offRoad: true });
      this.checkFlee(bee, undefined, { offRoad: true }, false);
    });
  }
}
