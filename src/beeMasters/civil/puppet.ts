import type { MovePriority } from "beeMasters/_Master";
import { setups } from "bees/creepSetups";
import type { SwarmOrder } from "orders/swarmOrder";
import { profile } from "profiler/decorator";
import { hiveStates } from "static/enums";

import { SwarmMaster } from "../_SwarmMaster";

@profile
export class PuppetMaster extends SwarmMaster<undefined> {
  // #region Properties (1)

  public constructor(parent: SwarmOrder<undefined>) {
    super(parent);
    Apiary.oracle.catchSpotter(this);
  }

  public override movePriority: MovePriority = 5;

  // #endregion Properties (1)

  // #region Public Accessors (2)

  public override get maxSpawns(): number {
    return 1;
  }

  public override get targetBeeCount(): number {
    return 1;
  }

  // #endregion Public Accessors (2)

  // #region Public Methods (2)

  public run() {
    _.forEach(this.activeBees, (bee) => {
      bee.goRest(this.pos, { offRoad: true });
      this.checkFlee(bee, undefined, { offRoad: true }, false);
    });
  }

  public override update() {
    super.update();
    if (this.pos.roomName in Game.rooms && !this.beesAmount) {
      this.parent.delete();
      return;
    }
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

  // #region Protected Methods (1)

  protected override defaultInfo(): undefined {
    return undefined;
  }

  // #endregion Protected Methods (1)
}
