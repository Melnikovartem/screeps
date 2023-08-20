import { SwarmMaster } from "../_SwarmMaster";

import { beeStates } from "../../enums";
import { setups } from "../../bees/creepSetups";
import { findOptimalResource } from "../../abstract/utils";

import { profile } from "../../profiler/decorator";
import type { Boosts } from "../_Master";

@profile
export class HelpTransferMaster extends SwarmMaster {
  boosts: Boosts = [
    { type: "capacity", lvl: 2 },
    { type: "capacity", lvl: 1 },
    { type: "capacity", lvl: 0 },
  ];
  get targetBeeCount() {
    if (!this.order) return 2;
    if (!this.order.memory.extraInfo) this.order.memory.extraInfo = 2;
    return this.order.memory.extraInfo;
  }
  set targetBeeCount(value) {
    if (this.order && this.order.memory.extraInfo)
      this.order.memory.extraInfo = value;
  }
  get maxSpawns() {
    return this.targetBeeCount;
  }
  set maxSpawns(_) {}

  res = RESOURCE_ENERGY;

  update() {
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

  run() {
    _.forEach(this.bees, (bee) => {
      if (bee.state === beeStates.boosting)
        if (!this.hive.cells.lab || this.hive.cells.lab.askForBoost(bee) === OK)
          bee.state = beeStates.chill;
    });

    _.forEach(this.activeBees, (bee) => {
      if (bee.state === beeStates.boosting) return;
      if (this.checkFlee(bee, this.hive)) return;
      if (
        this.hive.cells.defense.timeToLand < 50 &&
        bee.ticksToLive > 50 &&
        bee.pos.getRoomRangeTo(this.hive) === 1
      ) {
        bee.fleeRoom(this.hive.roomName, this.hive.opt);
        return;
      }
      const lab =
        bee.ticksToLive < 50 &&
        bee.pos.roomName === this.hive.roomName &&
        bee.boosted &&
        this.hive.cells.lab &&
        this.hive.cells.lab.getUnboostLab(bee.ticksToLive);
      if (lab) bee.goRest(lab.pos, this.hive.opt);
      else if (!Apiary.intel.getInfo(this.pos.roomName, 20).safePlace)
        bee.goRest(this.hive.rest, this.hive.opt);
      else if (bee.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        const room = Game.rooms[this.pos.roomName];
        const storage = room && room.storage;
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
