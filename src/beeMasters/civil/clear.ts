import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";
import { findOptimalResource } from "../../abstract/utils";

import { profile } from "../../profiler/decorator";
import { FULL_CAPACITY } from "../../abstract/terminalNetwork";

import type { ResTarget } from "../../hive";

@profile
export class ClearMaster extends SwarmMaster {

  get targetBeeCount() {
    return 1
  }

  set targetBeeCount(_) { }

  get maxSpawns() {
    return 1;
  }
  set maxSpawns(_) { }


  update() {
    super.update();
    if (this.checkBees()) {
      let setup = setups.queen.copy();
      setup.patternLimit = 4;
      setup.moveMax = 1;
      this.wish({
        setup: setup,
        priority: 1,
      });
    }
  }

  run() {
    let storage = this.hive.cells.storage!.storage
    _.forEach(this.activeBees, bee => {
      if (storage) {
        if (bee.store.getUsedCapacity() >= 0) {
          let res = findOptimalResource(bee.store)
          bee.drop(res);
        }
        if (storage.store.getFreeCapacity() <= FULL_CAPACITY) {
          let keys = <(keyof ResTarget)[]>Object.keys(this.hive.resState);
          let res = keys.reduce((prev, curr) => this.hive.resState[curr]! > this.hive.resState[prev]! ? curr : prev);
          bee.withdraw(storage, res);
        }
      }
    });
  }
}
