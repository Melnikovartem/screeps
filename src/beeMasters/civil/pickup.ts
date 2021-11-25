import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";
import { beeStates, hiveStates } from "../../enums";
import { findOptimalResource } from "../../abstract/utils";

import { profile } from "../../profiler/decorator";
import type { Boosts } from "../_Master";

@profile
export class PickupMaster extends SwarmMaster {
  waitPos = this.pos.getOpenPositions(true, 5)[0];
  boosts: Boosts | undefined = [{ type: "capacity", lvl: 0 }, { type: "fatigue", lvl: 0 }];

  update() {
    super.update();
    if (this.checkBees(this.hive.state !== hiveStates.battle)) {
      let setup = setups.pickup;
      if (this.pos.getRoomRangeTo(this.hive) <= 1) {
        setup = setup.copy();
        setup.moveMax = 50 / 3;
      }
      this.wish({
        setup: setup,
        priority: 4,
      });
    }
  }

  get target(): Tombstone | Ruin | Resource | StructureStorage | null | undefined {
    if (!this.order.memory.extraInfo)
      this.order.memory.extraInfo = "";
    return Game.getObjectById(this.order.memory.extraInfo);
  }

  set target(value) {
    if (value)
      this.order.memory.extraInfo = value.id;
    else
      this.order.memory.extraInfo = "";
  }

  getTarget() {
    let target: Tombstone | Ruin | Resource | StructureStorage | null | undefined;
    if (this.pos.roomName in Game.rooms) {
      if (this.pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_POWER_BANK).length)
        return target;
      let targets: (Tombstone | Ruin | Resource | StructureStorage)[] = <StructureStorage[]>this.pos.findInRange(FIND_STRUCTURES, 3)
        .filter(s => (<StructureStorage>s).store && (<StructureStorage>s).store.getUsedCapacity() > 0 && (!this.hive.room.storage || s.id !== this.hive.room.storage.id));
      if (!targets.length)
        targets = this.pos.findInRange(FIND_DROPPED_RESOURCES, 3).filter(r => r.amount > 0);
      if (!targets.length)
        targets = this.pos.findInRange(FIND_RUINS, 3).filter(r => r.store.getUsedCapacity() > 0);
      if (!targets.length)
        targets = this.pos.findInRange(FIND_TOMBSTONES, 3).filter(r => r.store.getUsedCapacity() > 0);

      target = this.pos.findClosest(targets);
      if (!target) {
        let room = Game.rooms[this.pos.roomName];
        // what a lie this is STRUCTURE_POWER_BANK
        if (this.pos.roomName !== this.hive.roomName) {
          if (!target)
            target = <StructureStorage>room.find(FIND_STRUCTURES)
              .filter(s => (<StructureStorage>s).store && (<StructureStorage>s).store.getUsedCapacity() > 0)[0];
        }
        if (!target)
          target = room.find(FIND_DROPPED_RESOURCES)[0];
        if (!target)
          target = room.find(FIND_TOMBSTONES).filter(r => r.store.getUsedCapacity() > 0)[0];
        if (!target)
          target = room.find(FIND_RUINS).filter(r => r.store.getUsedCapacity() > 0)[0];
        if (target)
          this.order.flag.setPosition(target.pos);
        else
          this.order.delete();
      }
    }
    return target;
  }

  run() {
    if (!this.hive.cells.storage)
      return;
    let storage = this.hive.cells.storage.storage;

    let target = this.target;
    if (!target) {
      target = this.getTarget();
      this.target = target;
    }

    _.forEach(this.bees, bee => {
      if (bee.state === beeStates.boosting)
        if (!this.hive.cells.lab || this.hive.cells.lab.askForBoost(bee) === OK)
          bee.state = beeStates.chill;
    });

    _.forEach(this.activeBees, bee => {
      if (bee.state === beeStates.boosting)
        return;
      if (bee.store.getFreeCapacity() === 0)
        bee.state = beeStates.fflush;
      else if (bee.store.getUsedCapacity() === 0)
        bee.state = beeStates.refill;


      switch (bee.state) {
        case beeStates.chill:
          bee.state = beeStates.refill;
        case beeStates.refill:
          if (target && bee.store.getFreeCapacity()) {
            if (target instanceof Resource)
              bee.pickup(target);
            else if (target.store)
              bee.withdraw(target, findOptimalResource(target.store));
            else {
              if (!this.waitPos)
                this.waitPos = this.pos;
              bee.goRest(this.waitPos);
            }
          } else if (bee.store.getUsedCapacity())
            bee.state = beeStates.fflush;
          break;
        case beeStates.fflush:
          if (!bee.target || !(bee.target in RESOURCES_ALL))
            bee.target = findOptimalResource(bee.store);
          if (bee.target) {
            let res = <ResourceConstant>bee.target;
            let ans = bee.transfer(storage, res);
            if (ans === OK) {
              bee.target = undefined;
              if (Apiary.logger)
                Apiary.logger.resourceTransfer(this.hive.roomName, "pickup", bee.store, storage!.store, res, 1);
            }
          } else
            bee.state = beeStates.chill;
          break;
      }
      this.checkFlee(bee);
    });
  }
}
