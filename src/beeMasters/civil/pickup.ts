import { SwarmMaster } from "../_SwarmMaster";

import { setups } from "../../bees/creepsetups";
import { beeStates } from "../../enums";
import { findOptimalResource } from "../../abstract/utils";

import { profile } from "../../profiler/decorator";

@profile
export class PickupMaster extends SwarmMaster {
  waitPos = this.order.pos.getOpenPositions(true, 5)[0];

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
    let target: Tombstone | Ruin | Resource | StructureStorage | undefined;
    let amount = 0;
    if (this.order.pos.roomName in Game.rooms) {
      target = this.order.pos.lookFor(LOOK_RUINS).filter(r => r.store.getUsedCapacity(RESOURCE_ENERGY) > 0)[0];
      if (!target)
        target = this.order.pos.lookFor(LOOK_TOMBSTONES).filter(r => r.store.getUsedCapacity(RESOURCE_ENERGY) > 0)[0];
      if (!target)
        target = this.order.pos.lookFor(LOOK_RESOURCES).filter(r => r.amount > 0)[0];
      if (!target)
        target = <StructureStorage>this.order.pos.lookFor(LOOK_STRUCTURES)
          .filter(s => (<StructureStorage>s).store && (<StructureStorage>s).store.getUsedCapacity() > 0)[0];

      if (target)
        if (target instanceof Resource)
          amount = target.amount;
        else
          amount = target.store.getUsedCapacity(RESOURCE_ENERGY)
      else {
        let room = Game.rooms[this.order.pos.roomName];
        target = room.find(FIND_DROPPED_RESOURCES)[0];
        if (!target && this.order.pos.roomName !== this.hive.roomName) {
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

    _.forEach(this.activeBees, bee => {
      if (bee.store.getFreeCapacity() === 0)
        bee.state = beeStates.fflush;
      else if (bee.store.getUsedCapacity() === 0)
        bee.state = beeStates.refill;

      switch (bee.state) {
        case beeStates.chill:
          bee.state = beeStates.refill;
        case beeStates.refill:
          if (target) {
            if (bee.store.getFreeCapacity() > 0)
              if (target instanceof Resource)
                bee.pickup(target);
              else
                bee.withdraw(target, findOptimalResource(target.store));
          } else if (bee.store.getUsedCapacity() > 0)
            bee.state = beeStates.fflush;
          else {
            if (!this.waitPos)
              this.waitPos = this.order.pos;
            bee.goRest(this.waitPos);
          }
          break;
        case beeStates.fflush:
          if (!bee.target)
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
      }
    });
  }
}
