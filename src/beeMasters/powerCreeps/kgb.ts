// import { beeStates, prefix } from "enums";
// import { setups } from "bees/creepSetups";
import { profile } from "profiler/decorator";

import { PowerCreepMaster } from "../_PowerMaster";

// kgb'shnik

@profile
export class KGBMaster extends PowerCreepMaster {
  // #region Public Methods (1)

  public override run() {
    if (this.hive.cells.defense.timeToLand < 50)
      this.powerCreep.fleeRoom(this.hiveName, this.hive.opt);
    else if (this.powerCreep.ticksToLive <= POWER_CREEP_LIFE_TIME / 5)
      this.powerCreep.renew(this.parent.powerSpawn, this.hive.opt);
    else if (!this.hive.controller.isPowerEnabled)
      this.powerCreep.enableRoom(this.hive.controller, this.hive.opt);
    else this.chillMove();
    super.run();
  }

  // #endregion Public Methods (1)
}
