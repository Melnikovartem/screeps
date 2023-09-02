import { setups } from "bees/creepSetups";
import { profile } from "profiler/decorator";
import { hiveStates } from "static/enums";

import { SwarmMaster } from "../_SwarmMaster";

@profile
export class PuppetMaster extends SwarmMaster {
  // #region Properties (1)

  public movePriority = 5 as const;

  // #endregion Properties (1)

  // #region Public Methods (2)

  public run() {
    _.forEach(this.activeBees, (bee) => {
      bee.goRest(this.pos, { offRoad: true });
      this.checkFlee(bee, undefined, { offRoad: true }, false);
    });
  }

  public update() {
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

  // #endregion Public Methods (2)
}
