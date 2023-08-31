import { setups } from "bees/creepSetups";
import { profile } from "profiler/decorator";
import { beeStates } from "static/enums";
import { findOptimalResource } from "static/utils";

import type { Boosts } from "../_Master";
import { SwarmMaster } from "../_SwarmMaster";

@profile
export class HelpTransferMaster extends SwarmMaster {
  public get boosts(): Boosts {
    return [
      { type: "capacity", lvl: 2 },
      { type: "capacity", lvl: 1 },
      { type: "capacity", lvl: 0 },
    ];
  }
  public get targetBeeCount() {
    if (!this.order) return 2;
    if (!this.order.memory.extraInfo) this.order.memory.extraInfo = 2;
    return this.order.memory.extraInfo as number;
  }
  public set targetBeeCount(value) {
    if (this.order && this.order.memory.extraInfo)
      this.order.memory.extraInfo = value;
  }
  public get maxSpawns() {
    return this.targetBeeCount;
  }
  public set maxSpawns(_) {}

  public res = RESOURCE_ENERGY;

  public update() {
    super.update();
    if (
      this.checkBees() &&
      Apiary.intel.getInfo(this.pos.roomName, 20).safePlace &&
      (this.hive.resState[this.res] || 0 > 0)
    )
      this.wish({
        setup: setups.pickup,
        priority: 8,
      });
  }

  public run() {
    this.preRunBoost();
    this.secureBoostsHive();

    _.forEach(this.activeBees, (bee) => {
      if (bee.state === beeStates.boosting) return;
      if (this.checkFlee(bee, this.hive)) return;
      if (
        this.hive.cells.defense.timeToLand < 50 &&
        bee.ticksToLive > 50 &&
        bee.pos.getRoomRangeTo(this.hive) === 1
      ) {
        bee.fleeRoom(this.hiveName, this.hive.opt);
        return;
      }
      const old = bee.ticksToLive < 50 && bee.pos.roomName === this.hiveName;
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
        if (storage)
          bee.transfer(
            storage,
            findOptimalResource(bee.store),
            undefined,
            this.hive.opt
          );
        else this.delete();
      } else if (
        this.hive.cells.storage &&
        bee.ticksToLive > this.pos.getRoomRangeTo(this.hive.pos, "lin") * 50
      )
        bee.withdraw(
          this.hive.cells.storage.storage,
          this.res,
          undefined,
          this.hive.opt
        );
      else this.removeBee(bee);
    });
  }
}
