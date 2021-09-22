

import { Master } from "../_Master";
import { beeStates } from "../../enums";
import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";
import type { StorageCell, StorageRequest } from "../../cells/stage1/storageCell";
import type { SpawnOrder } from "../../Hive";
import type { Bee } from "../../bees/bee";

@profile
export class ManagerMaster extends Master {
  cell: StorageCell;
  manager: Bee | undefined;

  constructor(storageCell: StorageCell) {
    super(storageCell.hive, storageCell.ref);
    this.cell = storageCell;
  }

  update() {
    super.update();

    if (this.checkBees()) {
      let order: SpawnOrder = {
        setup: setups.manager,
        amount: 1,
        priority: 7,
      };
      // desired linear regex from desmos))
      let lvl = this.hive.room.controller!.level;
      order.setup.patternLimit = lvl * lvl - lvl * 9 + 30;

      this.wish(order);
    }

    if (!this.manager || !Apiary.bees[this.manager.ref])
      if (this.beesAmount)
        this.manager = this.bees[Object.keys(this.bees)[0]];
      else
        return;

    let bee = this.manager;

    if (bee.state === beeStates.chill) {
      let targets: string[] = [];
      for (let k in this.cell.requests)
        if (this.cell.requests[k].amount > 0
          && (this.cell.requests[k].to.id === this.cell.storage.id || this.cell.requests[k].from.id === this.cell.storage.id))
          targets.push(k);
      if (targets.length) {
        bee.target = targets.reduce((prev, curr) => { return this.cell.requests[curr].priority < this.cell.requests[prev].priority ? curr : prev });
        let res = this.cell.requests[bee.target].resource;
        bee.state = bee.store.getUsedCapacity() > bee.store.getUsedCapacity(res) ? beeStates.fflush
          : bee.store.getUsedCapacity() === 0 ? beeStates.refill : beeStates.work;
      }
    }
  }

  run() {
    let bee = this.manager;
    if (!bee || !bee.creep.ticksToLive)
      return;

    if (bee.pos.roomName !== this.cell.pos.roomName)
      bee.state = beeStates.chill;
    if (bee.creep.ticksToLive && bee.creep.ticksToLive < 10)
      bee.state = beeStates.fflush;

    if (bee.target) {
      let request: StorageRequest = this.cell.requests[bee.target];
      if (request) {
        if (bee.state === beeStates.refill) {
          if (bee.store.getUsedCapacity(request.resource) >= request.amount)
            bee.state = beeStates.work;
          if (!bee.store.getFreeCapacity(request.resource))
            bee.state = beeStates.work;
          if (bee.store.getUsedCapacity() !== bee.store.getUsedCapacity(request.resource))
            bee.state = beeStates.fflush;
        }
        if (bee.state === beeStates.work) {
          if (bee.store.getUsedCapacity(request.resource) === 0)
            bee.state = beeStates.refill;
        }

        if (bee.state === beeStates.refill) {
          let amountBee = Math.min(bee.store.getFreeCapacity(request.resource),
            (<Store<ResourceConstant, false>>request.from.store).getUsedCapacity(request.resource),
            request.amount - bee.store.getUsedCapacity(request.resource));

          if (amountBee > 0)
            bee.withdraw(request.from, request.resource, amountBee) === OK
        }
        if (bee.state === beeStates.work) {
          let amountBee = Math.min(request.amount,
            bee.store.getUsedCapacity(request.resource),
            (<Store<ResourceConstant, false>>request.to.store).getFreeCapacity(request.resource));

          if (amountBee > 0 && bee.transfer(request.to, request.resource, amountBee) === OK)
            request.amount -= amountBee;
        }
      } else {
        bee.state = beeStates.fflush;
        bee.target = null;
      }
    } else
      bee.state = beeStates.fflush;

    if (bee.state === beeStates.fflush)
      if (bee.creep.store.getUsedCapacity() > 0 && this.cell.storage.store.getFreeCapacity() > 0) {
        let resource = <ResourceConstant>Object.keys(bee.store)[0];
        bee.transfer(this.cell.storage, resource);
      } else
        if (bee.target)
          bee.state = beeStates.refill;
        else
          bee.state = beeStates.chill;

    if (bee.state === beeStates.chill)
      bee.goRest(this.cell.pos);

    /* drop off extra res in sim
    let store = bee.store
    let ans: ResourceConstant = RESOURCE_ENERGY;
    for (let resourceConstant in store) {
      if (ans !== resourceConstant && store[<ResourceConstant>resourceConstant] > store.getUsedCapacity(ans))
        ans = <ResourceConstant>resourceConstant;
    }
    if (store[ans] > 0)
      bee.creep.drop(ans);
    */
  }
}
