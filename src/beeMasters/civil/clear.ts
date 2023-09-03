import type { MovePriority } from "beeMasters/_Master";
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
export class ClearMaster extends SwarmMaster<undefined> {
  // #region Properties (1)

  public override movePriority: MovePriority = 5;

  // #endregion Properties (1)

  // #region Public Accessors (2)

  public get maxSpawns() {
    return 1;
  }

  public get targetBeeCount() {
    return 1;
  }

  // #endregion Public Accessors (2)

  // #region Public Methods (2)

  // @todo add functions to manager queen
  public run() {
    const storage = this.hive.storage;
    if (!(storage instanceof StructureStorage)) return
    _.forEach(this.activeBees, (bee) => {
        if (bee.store.getUsedCapacity() >= 0) {
          const res = findOptimalResource(bee.store);
          bee.drop(res);
        }
        if (this.hive.cells.storage.storageFreeCapacity() <= FULL_CAPACITY) {
          const keys = Object.keys(this.hive.resState) as (keyof ResTarget)[];
          const res = keys.reduce((prev, curr) =>
            this.hive.resState[curr]! > this.hive.resState[prev]! ? curr : prev
          );
          bee.withdraw(storage, res);
        }
    });
  }

  public override update() {
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

  // #region Protected Methods (1)

  protected override defaultInfo(): undefined {
    return undefined;
  }

  // #endregion Protected Methods (1)
}
