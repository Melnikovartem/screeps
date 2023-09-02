import type { MovePriority } from "beeMasters/_Master";
import { setups } from "bees/creepSetups";
import type { BoostRequest } from "cells/stage1/laboratoryCell";
import { profile } from "profiler/decorator";
import { beeStates, hiveStates } from "static/enums";
import { findOptimalResource } from "static/utils";

import { SwarmMaster } from "../_SwarmMaster";

type PickupTarget =
  | Tombstone
  | Ruin
  | Resource
  | StructureStorage
  | StructureContainer;
interface PickupInfo {
  // #region Properties (2)

  id: Id<PickupTarget> | undefined;
  tc: number;

  // #endregion Properties (2)
  // targetBeeCount
}

@profile
export class PickupMaster extends SwarmMaster<PickupInfo> {
  // #region Properties (2)

  private waitPos = this.pos.getOpenPositions(true, 3)[0];

  public override movePriority: MovePriority = 4;

  // #endregion Properties (2)

  // #region Public Accessors (5)

  public override get boosts(): BoostRequest[] {
    if (this.pos.getRoomRangeTo(this.hive) <= 1) return [];
    return [
      { type: "capacity", lvl: 0 },
      { type: "fatigue", lvl: 0 },
    ];
  }

  public override get maxSpawns(): number {
    return this.targetBeeCount;
  }

  public get target() {
    if (!this.info.id) return;
    return Game.getObjectById(this.info.id);
  }

  public set target(value) {
    if (value) this.info.id = value.id;
    else this.info.id = undefined;
  }

  public override get targetBeeCount(): number {
    return this.info.tc;
  }

  // #endregion Public Accessors (5)

  // #region Public Methods (3)

  public getTarget() {
    let target: PickupTarget | undefined | null;
    if (this.pos.roomName in Game.rooms) {
      if (
        this.pos
          .lookFor(LOOK_STRUCTURES)
          .filter((s) => s.structureType === STRUCTURE_POWER_BANK).length
      )
        return target;
      let targets: PickupTarget[] = this.pos
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
              )[0] as StructureStorage | StructureContainer;
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
        if (target) this.parent.setPosition(target.pos);
        else this.parent.delete();
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
        // fall through
        case beeStates.work: {
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
        }
        case beeStates.boosting:
          break;
      }
      this.checkFlee(bee);
    });
  }

  public override update() {
    super.update();
    if (this.checkBees(this.hive.state <= hiveStates.battle)) {
      let setup = setups.pickup;
      if (this.pos.getRoomRangeTo(this.hive) <= 1) {
        setup = setup.copy();
        setup.moveMax = 50 / 3;
      }
      this.wish({
        setup,
        priority: 4,
      });
    }
  }

  // #endregion Public Methods (3)

  // #region Protected Methods (1)

  protected override defaultInfo(): PickupInfo {
    return {
      id: undefined,
      tc: 1,
    };
  }

  // #endregion Protected Methods (1)
}
