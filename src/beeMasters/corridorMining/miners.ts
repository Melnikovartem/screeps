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
    super(parent.hive, parent.order.ref + prefix.miner);
    this.parent = parent;
    this.targetBeeCount = this.parent.positions.length;
  }

  update() {
    super.update();

    if (!this.hive.puller)
      return;

    if (this.checkBees(false, CREEP_LIFE_TIME - this.parent.roadTime)
      && this.parent.operational
      && this.hive.puller.removeFreePuller(this.parent.roadTime))
      this.wish({
        setup: setups.miner.deposit,
        priority: 8,
      });
  }

  run() {
    let target = this.parent.target!;
    if (!target || target.cooldown)
      return;
    _.forEach(this.activeBees, bee => {
      if (target.pos.isNearTo(bee)) {
        bee.state = beeStates.work;
        if (bee.store.getFreeCapacity() >= this.parent.workAmount && bee.harvest(target) === OK && Apiary.logger)
          Apiary.logger.addResourceStat(this.hive.roomName, "deposit", this.parent.workAmount, target.depositType);
      } else
        bee.state = beeStates.chill;
    });
  }
}
