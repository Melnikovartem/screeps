import { SwarmMaster } from "../_SwarmMaster";

import { beeStates } from "../../enums";
import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";
import type { Boosts } from "../_Master";

@profile
export class HelpUpgradeMaster extends SwarmMaster {

  boosts: Boosts = [{ type: "upgrade", lvl: 2 }, { type: "upgrade", lvl: 1 }, { type: "upgrade", lvl: 0 }];
  get targetBeeCount() {
    if (!this.order)
      return 0;
    if (!this.order.memory.extraInfo)
      this.order.memory.extraInfo = 5;
    return this.order.memory.extraInfo;
  }
  set targetBeeCount(value) {
    if (this.order && this.order.memory.extraInfo)
      this.order.memory.extraInfo = value
  }

  maxSpawns = 100;

  update() {
    super.update();

    let controller = Game.rooms[this.pos.roomName].controller;
    if (!controller || !controller.my) {
      this.order.delete();
      return;
    }
    if (this.checkBees() && Apiary.intel.getInfo(this.pos.roomName).safePlace && this.hive.resState[RESOURCE_ENERGY] > 0)
      this.wish({
        setup: setups.upgrader.manual,
        priority: 8,
      });
  }

  run() {
    let controller = Game.rooms[this.pos.roomName] && Game.rooms[this.pos.roomName].controller;

    _.forEach(this.bees, bee => {
      if (bee.state === beeStates.boosting)
        if (!this.hive.cells.lab || this.hive.cells.lab.askForBoost(bee) === OK)
          bee.state = beeStates.chill;
    });

    _.forEach(this.activeBees, bee => {
      if (bee.state === beeStates.boosting)
        return;
      if (this.checkFlee(bee, this.hive))
        return;
      if (this.hive.cells.defense.timeToLand < 50 && bee.ticksToLive > 50 && bee.pos.getRoomRangeTo(this.hive) === 1) {
        bee.fleeRoom(this.hive.roomName, this.hive.opt);
        return;
      }
      let lab = bee.ticksToLive < 50 && bee.pos.roomName === this.hive.roomName && this.hive.cells.lab && this.hive.cells.lab.getUnboostLab(bee.ticksToLive);
      if (lab)
        bee.goRest(lab.pos, this.hive.opt);
      else if (!Apiary.intel.getInfo(this.pos.roomName, 20).safePlace)
        bee.goRest(this.hive.rest, this.hive.opt);
      else if (bee.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        if (controller)
          bee.upgradeController(controller, this.hive.opt);
        else
          bee.goRest(this.pos, this.hive.opt);
      } else if (this.hive.cells.storage)
        bee.withdraw(this.hive.cells.storage.storage, RESOURCE_ENERGY, undefined, this.hive.opt);
    });
  }
}
