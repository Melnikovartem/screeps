// import { beeStates, prefix } from "../../enums";
// import { setups } from "../../bees/creepSetups";
import { profile } from "../../profiler/decorator";
import { PowerMaster } from "../_PowerMaster";

// kgb'shnik

@profile
export class KGBMaster extends PowerMaster {
  // #region Public Methods (1)

  public run() {
    if (this.hive.cells.defense.timeToLand < 50)
      this.powerCreep.fleeRoom(this.hiveName, this.hive.opt);
    else if (this.powerCreep.ticksToLive <= POWER_CREEP_LIFE_TIME / 5)
      this.powerCreep.renew(this.cell.powerSpawn, this.hive.opt);
    else if (!this.hive.controller.isPowerEnabled)
      this.powerCreep.enableRoom(this.hive.controller, this.hive.opt);
    else this.chillMove();
    super.run();
  }

  // #endregion Public Methods (1)

  // #region Private Methods (1)

  private chillMove() {
    // keep 150ops to 80% fill of storage
    const upperBound = Math.max(
      this.powerCreep.store.getCapacity(RESOURCE_OPS) * 0.9,
      150
    );
    const lowerBound = 150;
    const currOps = this.powerCreep.store.getUsedCapacity(RESOURCE_OPS);
    const targetBalance = Math.round(upperBound * 0.7 + lowerBound * 0.3);
    if (currOps < lowerBound)
      this.powerCreep.withdraw(
        this.cell.sCell.storage,
        RESOURCE_OPS,
        targetBalance - currOps,
        this.hive.opt
      );
    if (currOps > upperBound) {
      this.powerCreep.transfer(
        this.cell.sCell.storage,
        RESOURCE_OPS,
        currOps - targetBalance,
        this.hive.opt
      );
    } else this.powerCreep.goRest(this.cell.pos, this.hive.opt);
  }

  // #endregion Private Methods (1)
}
