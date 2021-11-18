import { Master } from "../_Master";

import { beeStates, prefix } from "../../enums";
import { setups } from "../../bees/creepsetups";
// import { BOOST_MINERAL } from "../../cells/stage1/laboratoryCell";

import { profile } from "../../profiler/decorator";
import type { DepositMaster } from "./deposit";
// import type { Boosts } from "../_Master";

@profile
export class DepositMinerMaster extends Master {
  parent: DepositMaster;
  movePriority = <1>1;

  constructor(parent: DepositMaster) {
    super(parent.hive, parent.ref + prefix.miner);
    this.parent = parent;
    this.targetBeeCount = this.parent.positions;
  }

  update() {
    super.update();

    if (this.checkBees(false, CREEP_LIFE_TIME - this.parent.roadTime) && this.parent.operational
      && _.filter(this.parent.puller.bees, b => b.state === beeStates.chill).length && !_.filter(this.bees, b => b.creep.spawning).length)
      this.wish({
        setup: setups.miner.deposit,
        priority: 8,
      });
  }

  run() {
    let target = this.parent.target!;
    if (!target)
      return;
    _.forEach(this.activeBees, bee => {
      if (target.pos.isNearTo(bee)) {
        bee.state = beeStates.work;
        if (!target.cooldown)
          bee.harvest(target);
      } else
        bee.state = beeStates.chill;
    });
  }
}
