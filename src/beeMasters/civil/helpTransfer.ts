import { setups } from "bees/creepSetups";
import { profile } from "profiler/decorator";
import { beeStates } from "static/enums";
import { findOptimalResource } from "static/utils";

import type { Boosts, MovePriority } from "../_Master";
import { SwarmMaster } from "../_SwarmMaster";

@profile
export class HelpTransferMaster extends SwarmMaster<number> {
  // #region Properties (2)

  public override movePriority: MovePriority = 4;
  public res = RESOURCE_ENERGY;

  // #endregion Properties (2)

  // #region Public Accessors (3)

  public override get boosts(): Boosts {
    return [{ type: "capacity", lvl: 2 }];
  }

  public get maxSpawns() {
    return this.targetBeeCount * 3; // 30 about 0.5M energy per order
  }

  public get targetBeeCount() {
    return this.info;
  }

  // #endregion Public Accessors (3)

  // #region Public Methods (3)

  public override defaultInfo(): number {
    return 10;
  }

  public run() {
    this.preRunBoost();
    this.secureBoostsHive();

    _.forEach(this.activeBees, (bee) => {
      if (bee.state === beeStates.boosting) return;
      if (this.checkFlee(bee, bee.store.getUsedCapacity() ? this : this.hive))
        return;
      // kinda should use TimeToTarget
      const old = bee.ticksToLive < 150 && bee.pos.roomName === this.hiveName;
      if (old) this.recycleBee(bee);
      else if (!Apiary.intel.getInfo(this.pos.roomName, 20).safePlace)
        bee.goRest(this.hive.rest, this.hive.opt);
      else if (bee.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        const room = Game.rooms[this.pos.roomName];
        const storage =
          (room && room.storage) ||
          (this.pos
            .lookFor(LOOK_STRUCTURES)
            .filter(
              (s) => s.structureType === STRUCTURE_CONTAINER
            )[0] as StructureContainer);
        if (storage) {
          const res = findOptimalResource(bee.store);
          const ans = bee.transfer(storage, res, undefined, this.hive.opt);
          if (ans === OK)
            Apiary.logger.addResourceStat(
              this.pos.roomName,
              "local_import",
              Math.min(
                storage.store.getFreeCapacity(res),
                bee.store.getUsedCapacity(res)
              ),
              res
            );
        } else bee.goRest(this.pos); // else this.delete() // a little overhead, but yeah
      } else if (
        bee.ticksToLive > this.pos.getRoomRangeTo(this.hive.pos, "lin") * 50 &&
        this.hive.storage
      ) {
        const ans = bee.withdraw(
          this.hive.storage,
          this.res,
          undefined,
          this.hive.opt
        );
        if (ans === OK)
          Apiary.logger.addResourceStat(
            this.hiveName,
            "local_export",
            -Math.min(
              this.hive.storage.store.getUsedCapacity(this.res),
              bee.store.getFreeCapacity(this.res)
            ),
            this.res
          );
      } else this.recycleBee(bee);
    });
  }

  public override update() {
    super.update();
    if (
      this.checkBees() &&
      Apiary.intel.getInfo(this.pos.roomName, 20).safePlace &&
      this.hive.getResState(this.res) > 0
    )
      this.wish({
        setup: setups.pickup,
        priority: 8,
      });
  }

  // #endregion Public Methods (3)
}
