import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";
import { beeStates } from "../../enums";
import { findOptimalResource } from "../../abstract/utils";
import { CIVILIAN_FLEE_DIST } from "../_Master";

import { profile } from "../../profiler/decorator";
import type { Boosts } from "../_Master";

@profile
export class PickupMaster extends SwarmMaster {
  waitPos = this.order.pos.getOpenPositions(true, 5)[0];
  boosts: Boosts | undefined = [{ type: "capacity", lvl: 0 }, { type: "fatigue", lvl: 0 }];

  update() {
    super.update();
    if (this.checkBees()) {
      this.wish({
        setup: setups.pickup,
        priority: 4,
      });
    }
  }

  getTarget() {
    let target: Tombstone | Ruin | Resource | StructureStorage | null | undefined;
    let amount = 0;
    if (this.order.pos.roomName in Game.rooms) {
      let targets: (Tombstone | Ruin | Resource | StructureStorage)[] = <StructureStorage[]>this.order.pos.findInRange(FIND_STRUCTURES, 3)
        .filter(s => (<StructureStorage>s).store && (<StructureStorage>s).store.getUsedCapacity() > 0 && (!this.hive.room.storage || s.id !== this.hive.room.storage.id));
      if (!targets.length)
        targets = this.order.pos.findInRange(FIND_DROPPED_RESOURCES, 3).filter(r => r.amount > 0);
      if (!targets.length)
        targets = this.order.pos.findInRange(FIND_RUINS, 3).filter(r => r.store.getUsedCapacity(RESOURCE_ENERGY) > 0);
      if (!targets.length)
        targets = this.order.pos.findInRange(FIND_TOMBSTONES, 3).filter(r => r.store.getUsedCapacity(RESOURCE_ENERGY) > 0);

      target = this.order.pos.findClosest(targets);

      if (target)
        if (target instanceof Resource)
          amount = target.amount;
        else
          amount = target.store.getUsedCapacity(RESOURCE_ENERGY)
      else {
        let room = Game.rooms[this.order.pos.roomName];
        target = room.find(FIND_DROPPED_RESOURCES)[0];
        if (!target && this.order.pos.roomName !== this.hive.roomName) {
          // what a lie this is STRUCTURE_POWER_BANK
          target = <StructureStorage>room.find(FIND_STRUCTURES).filter(s => s.structureType === STRUCTURE_POWER_BANK)[0];
          if (!target)
            target = <StructureStorage>room.find(FIND_STRUCTURES)
              .filter(s => (<StructureStorage>s).store && (<StructureStorage>s).store.getUsedCapacity() > 0)[0];
          if (!target)
            target = this.hive.room.find(FIND_DROPPED_RESOURCES)[0];
        }
        if (target)
          this.order.flag.setPosition(target.pos);
        else
          this.order.delete();
      }
    }
    return { target: target, amount: amount };
  }

  run() {
    let storage = this.hive.cells.storage && this.hive.cells.storage.storage;
    if (!storage)
      return;

    let target = this.getTarget().target;

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

      let enemy = Apiary.intel.getEnemyCreep(bee, 25);
      let contr = Game.rooms[bee.pos.roomName].controller;
      if (enemy && (!contr || !contr.my || !contr.safeMode)) {
        enemy = Apiary.intel.getEnemyCreep(bee);
        if (enemy && enemy.pos.getRangeTo(bee) <= CIVILIAN_FLEE_DIST)
          bee.state = beeStates.flee;
      }

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
                this.waitPos = this.order.pos;
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
              delete bee.target;
              if (Apiary.logger)
                Apiary.logger.resourceTransfer(this.hive.roomName, "pickup", bee.store, storage!.store, res, 1);
            }
          } else
            bee.state = beeStates.chill;
          break;
        case beeStates.flee:
          if (enemy && enemy.pos.getRangeTo(bee) < CIVILIAN_FLEE_DIST)
            bee.flee(enemy, this.hive.cells.defense);
          bee.state = beeStates.work;
          break;
      }
    });
  }
}
