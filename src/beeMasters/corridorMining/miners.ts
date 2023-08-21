import { setups } from "bees/creepSetups";
import { beeStates, prefix } from "enums";
import { profile } from "profiler/decorator";

import { Master } from "../_Master";
import type { DepositMaster } from "./deposit";

@profile
export class DepositMinerMaster extends Master {
  public parent: DepositMaster;
  public movePriority = 1 as const;

  public constructor(parent: DepositMaster) {
    super(parent.hive, parent.order.ref + prefix.miner);
    this.parent = parent;
    this.targetBeeCount = this.parent.positions.length;
  }

  public checkBees() {
    return (
      this.parent.shouldSpawn &&
      super.checkBees(true, CREEP_LIFE_TIME - this.parent.roadTime)
    );
  }

  public update() {
    super.update();

    if (!this.hive.puller) return;

    if (
      this.checkBees() &&
      this.hive.puller.removeFreePuller(this.parent.roadTime)
    )
      this.wish({
        setup: setups.miner.deposit,
        priority: 7,
      });
  }

  public run() {
    const target = this.parent.target!;
    if (!target || target.cooldown) return;
    if (
      this.activeBees.filter(
        (b) =>
          b.store.getFreeCapacity() < this.parent.workAmount &&
          b.store.getCapacity() >= this.parent.workAmount &&
          b.pos.isNearTo(this.parent)
      ).length
    )
      return;
    _.forEach(this.activeBees, (bee) => {
      if (target.pos.isNearTo(bee)) {
        bee.state = beeStates.work;
        if (bee.harvest(target) === OK && Apiary.logger)
          Apiary.logger.addResourceStat(
            this.hive.roomName,
            "deposit",
            this.parent.workAmount,
            target.depositType
          );
      } else bee.state = beeStates.chill;
    });
  }
}
