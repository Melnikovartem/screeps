import { setups } from "bees/creepSetups";
import type { FlagOrder } from "orders/order";
import { profile } from "profiler/decorator";
import { beeStates } from "static/enums";

import type { Boosts } from "../_Master";
import { SwarmMaster } from "../_SwarmMaster";

@profile
export class HelpUpgradeMaster extends SwarmMaster {
  public constructor(order: FlagOrder) {
    super(order);
    this.maxSpawns = 100;
  }

  public get boosts(): Boosts {
    return [
      { type: "upgrade", lvl: 2 },
      { type: "upgrade", lvl: 1 },
      { type: "upgrade", lvl: 0 },
    ];
  }

  public get targetBeeCount() {
    if (!this.order) return 0;
    if (!this.order.memory.extraInfo) this.order.memory.extraInfo = 5;
    return this.order.memory.extraInfo as number;
  }

  public set targetBeeCount(value) {
    if (this.order && this.order.memory.extraInfo)
      this.order.memory.extraInfo = value;
  }

  public update() {
    super.update();

    const controller = Game.rooms[this.pos.roomName].controller;
    if (
      !controller ||
      !controller.my ||
      (controller.level === 8 && !this.beesAmount)
    ) {
      this.order.delete();
      return;
    }
    if (
      this.checkBees() &&
      Apiary.intel.getInfo(this.pos.roomName).safePlace &&
      this.hive.resState[RESOURCE_ENERGY] >= 0 &&
      controller.level < 8
    )
      this.wish({
        setup: setups.upgrader.manual,
        priority: 8,
      });
  }

  public run() {
    const controller =
      Game.rooms[this.pos.roomName] && Game.rooms[this.pos.roomName].controller;

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
        bee.fleeRoom(this.roomName, this.hive.opt);
        return;
      }
      const lab =
        bee.ticksToLive < 50 &&
        bee.pos.roomName === this.roomName &&
        this.hive.cells.lab &&
        this.hive.cells.lab.getUnboostLab(bee.ticksToLive);
      if (lab) bee.goRest(lab.pos, this.hive.opt);
      else if (!Apiary.intel.getInfo(this.pos.roomName, 20).safePlace)
        bee.goRest(this.hive.rest, this.hive.opt);
      else if (bee.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        if (controller) bee.upgradeController(controller, this.hive.opt);
        else bee.goRest(this.pos, this.hive.opt);
      } else if (
        this.hive.cells.storage &&
        bee.ticksToLive > this.pos.getRoomRangeTo(this.hive.pos, "lin") * 50
      )
        bee.withdraw(
          this.hive.cells.storage.storage,
          RESOURCE_ENERGY,
          undefined,
          this.hive.opt
        );
      else this.removeBee(bee);
    });
  }
}
