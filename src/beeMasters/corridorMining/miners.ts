import { setups } from "bees/creepSetups";
import { profile } from "profiler/decorator";
import { beeStates, prefix } from "static/enums";

import { Master } from "../_Master";
import type { DepositMaster } from "./deposit";

// no need to innit from memory as DepositMaster inits
@profile
export class DepositMinerMaster extends Master<DepositMaster> {
  // implementation block
  // they cant move :/
  public movePriority = 1 as const;
  public get targetBeeCount() {
    return this.parent.positions.length;
  }
  // extra overload block
  public checkBees = () => {
    return (
      this.parent.shouldSpawn &&
      super.checkBees(true, CREEP_LIFE_TIME - this.parent.roadTime)
    );
  };

  public constructor(parent: DepositMaster) {
    super(parent, parent.ref + prefix.miner);
  }

  // update - run
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
        if (bee.harvest(target) === OK)
          Apiary.logger.addResourceStat(
            this.hiveName,
            "deposit",
            this.parent.workAmount,
            target.depositType
          );
      } else bee.state = beeStates.chill;
    });
  }
}
