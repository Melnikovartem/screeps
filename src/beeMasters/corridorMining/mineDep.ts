import { setups } from "bees/creepSetups";
import { profile } from "profiler/decorator";
import { beeStates, prefix } from "static/enums";

import { Master } from "../_Master";
import type { DepositMaster } from "./deposit";

// no need to innit from memory as DepositMaster inits
@profile
export class DepositMinerMaster extends Master<DepositMaster> {
  // #region Properties (1)

  // extra overload block
  // they cant move :/
  public movePriority = 1 as const;

  // #endregion Properties (1)

  // #region Constructors (1)

  public constructor(parent: DepositMaster) {
    super(parent, prefix.minerDep + parent.parent.ref);
  }

  // #endregion Constructors (1)

  // #region Public Accessors (1)

  public get targetBeeCount() {
    return this.parent.positions.length;
  }

  // #endregion Public Accessors (1)

  // #region Public Methods (2)

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

  public override update() {
    super.update();

    if (!this.hive.cells.corridorMining) return;

    if (
      this.parent.shouldSpawn &&
      this.checkBees(false, CREEP_LIFE_TIME - this.parent.roadTime) &&
      this.hive.cells.corridorMining.master.removeFreePuller(
        this.parent.roadTime
      ) // reserve a puller
    )
      this.wish({
        setup: setups.miner.deposit,
        priority: 7,
      });
  }

  // #endregion Public Methods (2)
}
