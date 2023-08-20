import { FULL_CAPACITY } from "abstract/terminalNetwork";
import { findOptimalResource } from "abstract/utils";
import { setups } from "bees/creepSetups";
import type { ResTarget } from "Hive";
import { profile } from "profiler/decorator";

import { SwarmMaster } from "../_SwarmMaster";

@profile
export class ClearMaster extends SwarmMaster {
  public get targetBeeCount() {
    return 1;
  }

  public set targetBeeCount(_) {}

  public get maxSpawns() {
    return 1;
  }
  public set maxSpawns(_) {}

  public update() {
    super.update();
    if (this.checkBees()) {
      const setup = setups.queen.copy();
      setup.patternLimit = 4;
      setup.moveMax = 1;
      this.wish({
        setup,
        priority: 1,
      });
    }
  }

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
}