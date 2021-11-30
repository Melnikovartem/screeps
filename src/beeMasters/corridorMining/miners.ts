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
      && this.parent.shouldSpawn
      && this.hive.puller.removeFreePuller(this.parent.roadTime))
      this.wish({
        setup: setups.miner.deposit,
        priority: 8,
      });
    else if (this.waitingForBees)
      this.hive.puller.removeFreePuller(this.parent.roadTime);
  }

  run() {
    let target = this.parent.target!;
    if (!target || target.cooldown)
      return;
    if (this.activeBees.filter(b => b.store.getFreeCapacity() < this.parent.workAmount
      && b.store.getCapacity() >= this.parent.workAmount
      && b.pos.isNearTo(this.parent)).length)
      return;
    _.forEach(this.activeBees, bee => {
      if (target.pos.isNearTo(bee)) {
        bee.state = beeStates.work;
        if (bee.harvest(target) === OK && Apiary.logger)
          Apiary.logger.addResourceStat(this.hive.roomName, "deposit", this.parent.workAmount, target.depositType);
      } else
        bee.state = beeStates.chill;
    });
  }
}
