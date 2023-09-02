import { setups } from "bees/creepSetups";
import { FULL_CAPACITY } from "bugSmuggling/terminalNetwork";
import type { ResTarget } from "hive/hive-declarations";
import { profile } from "profiler/decorator";
import { findOptimalResource } from "static/utils";

import { SwarmMaster } from "../_SwarmMaster";

/** Just puts stuff on the ground when we have too much
 *
 * @todo impliment into managers
 */
@profile
export class ClearMaster extends SwarmMaster {
  // #region Public Accessors (4)

  public get maxSpawns() {
    return 1;
  }

  public set maxSpawns(_) {}

  public get targetBeeCount() {
    return 1;
  }

  public set targetBeeCount(_) {}

  // #endregion Public Accessors (4)

  // #region Public Methods (2)

  // @todo add functions to manager queen
  public run() {
    const storage = this.hive.cells.storage!.storage;
    _.forEach(this.activeBees, (bee) => {
      if (storage) {
        if (bee.store.getUsedCapacity() >= 0) {
          const res = findOptimalResource(bee.store);
          bee.drop(res);
        }
        if (storage.store.getFreeCapacity() <= FULL_CAPACITY) {
          const keys = Object.keys(this.hive.resState) as (keyof ResTarget)[];
          const res = keys.reduce((prev, curr) =>
            this.hive.resState[curr]! > this.hive.resState[prev]! ? curr : prev
          );
          bee.withdraw(storage, res);
        }
      }
    });
  }

  public update() {
    super.update();
    if (this.checkBees()) {
      const setup = setups.managerQueen.copy();
      setup.patternLimit = 4;
      setup.moveMax = 1;
      this.wish({
        setup,
        priority: 1,
      });
    }
  }

  // #endregion Public Methods (2)
}
