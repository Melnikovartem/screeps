import { setups } from "bees/creepSetups";
import type { FlagOrder } from "orders/order";
import { profile } from "profiler/decorator";
import { beeStates, hiveStates } from "static/enums";
import { findOptimalResource } from "static/utils";

import { SwarmMaster } from "../_SwarmMaster";

@profile
export class PickupMaster extends SwarmMaster {
  private waitPos = this.pos.getOpenPositions(true, 3)[0];
  public constructor(order: FlagOrder) {
    super(order);
    this.boosts = [
      { type: "capacity", lvl: 0 },
      { type: "fatigue", lvl: 0 },
    ];
  }

  public update() {
    super.update();
    if (this.checkBees(this.hive.state <= hiveStates.battle)) {
      let setup = setups.pickup;
      if (this.pos.getRoomRangeTo(this.hive) <= 1) {
        setup = setup.copy();
        setup.moveMax = 50 / 3;
        this.boosts = undefined;
      }
      this.wish({
        setup,
        priority: 4,
      });
    }
  }

  public get target() {
    if (!this.order.memory.extraInfo) this.order.memory.extraInfo = "";
    return Game.getObjectById(this.order.memory.extraInfo) as
      | Tombstone
      | Ruin
      | Resource
      | StructureStorage
      | null
      | undefined;
  }

  public set target(value) {
    if (value) this.order.memory.extraInfo = value.id;
    else this.order.memory.extraInfo = "";
  }

  public getTarget() {
    let target:
      | Tombstone
      | Ruin
      | Resource
      | StructureStorage
      | null
      | undefined;
    if (this.pos.roomName in Game.rooms) {
      if (
        this.pos
          .lookFor(LOOK_STRUCTURES)
          .filter((s) => s.structureType === STRUCTURE_POWER_BANK).length
      )
        return target;
      let targets: (Tombstone | Ruin | Resource | StructureStorage)[] = this.pos
        .findInRange(FIND_STRUCTURES, 3)
        .filter(
          (s) =>
            (s as StructureStorage).store &&
            (s as StructureStorage).store.getUsedCapacity() > 0 &&
            (!this.hive.room.storage || s.id !== this.hive.room.storage.id)
        ) as StructureStorage[];
      if (!targets.length)
        targets = this.pos
          .findInRange(FIND_DROPPED_RESOURCES, 3)
          .filter((r) => r.amount > 0);
      if (!targets.length)
        targets = this.pos
          .findInRange(FIND_RUINS, 3)
          .filter((r) => r.store.getUsedCapacity() > 0);
      if (!targets.length)
        targets = this.pos
          .findInRange(FIND_TOMBSTONES, 3)
          .filter((r) => r.store.getUsedCapacity() > 0);

      target = this.pos.findClosest(targets);
      if (!target) {
        const room = Game.rooms[this.pos.roomName];
        // what a lie this is STRUCTURE_POWER_BANK
        if (this.pos.roomName !== this.hiveName) {
          if (!target)
            target = room
              .find(FIND_STRUCTURES)
              .filter(
                (s) =>
                  (s as StructureStorage).store &&
                  (s as StructureStorage).store.getUsedCapacity() > 0
              )[0] as StructureStorage;
        }
        if (!target) target = room.find(FIND_DROPPED_RESOURCES)[0];
        if (!target)
          target = room
            .find(FIND_TOMBSTONES)
            .filter((r) => r.store.getUsedCapacity() > 0)[0];
        if (!target)
          target = room
            .find(FIND_RUINS)
            .filter((r) => r.store.getUsedCapacity() > 0)[0];
        if (target) this.order.flag.setPosition(target.pos);
        else this.order.delete();
      }
    }
    return target;
  }

  public run() {
    if (!this.hive.cells.storage) return;
    const storage = this.hive.cells.storage.storage;

    let target = this.target;
    if (!target || ("store" in target && !target.store.getUsedCapacity())) {
      target = this.getTarget();
      this.target = target;
    }

    this.preRunBoost();

    _.forEach(this.activeBees, (bee) => {
      switch (bee.state) {
        case beeStates.chill:
          if (!bee.store.getFreeCapacity()) bee.state = beeStates.work;
          else if (target instanceof Resource) bee.pickup(target);
          else if (target && target.store)
            bee.withdraw(target, findOptimalResource(target.store, -1));
          else if (bee.store.getUsedCapacity()) bee.state = beeStates.work;
          else bee.goRest(this.waitPos);
          if (bee.state !== beeStates.work) break;
        case beeStates.work:
          if (!bee.store.getUsedCapacity()) {
            bee.state = beeStates.chill;
            break;
          }
          if (
            this.hive.cells.defense.timeToLand < 50 &&
            bee.ticksToLive > 50 &&
            bee.pos.getRoomRangeTo(this.hive) === 1
          ) {
            bee.fleeRoom(this.hiveName);
            break;
          }
          const res = findOptimalResource(bee.store);
          const ans = bee.transfer(storage, res);
          if (ans === OK)
            Apiary.logger.resourceTransfer(
              this.hiveName,
              res === RESOURCE_POWER ? "power_mining" : "pickup",
              bee.store,
              storage.store,
              res,
              1
            );
          break;
        case beeStates.boosting:
          break;
      }
      this.checkFlee(bee);
    });
  }
}
