import type { storageCell, StorageRequest } from "../../cells/stage1/storageCell";

import { Setups } from "../../bees/creepSetups";
import { Master, states } from "../_Master";
import type { Bee } from "../../bees/bee";
import type { SpawnOrder } from "../../Hive";
import { profile } from "../../profiler/decorator";

@profile
export class managerMaster extends Master {
  cell: storageCell;
  manager: Bee | undefined;

  constructor(storageCell: storageCell) {
    super(storageCell.hive, storageCell.ref);
    this.cell = storageCell;
  }

  update() {
    super.update();
    if (!this.manager)
      if (this.beesAmount)
        this.manager = this.bees[Object.keys(this.bees)[0]];
      else
        return;

    let emergencyRequests = _.filter(this.cell.requests, (r) => r.priority < 2);
    let bee = this.manager;

    if (bee.state === states.chill || emergencyRequests.length) {
      if (bee.target && this.cell.requests[bee.target]) {
        if (emergencyRequests.length) {
          let closest = this.cell.storage.pos.findClosest(_.map(emergencyRequests, (r) => r.to))!;
          let target = _.filter(emergencyRequests, (r) => r.to.id === closest.id)[0];
          if (this.cell.requests[bee.target].priority > target.priority
            || this.cell.pos.getRangeTo(target.to.pos) > this.cell.pos.getRangeTo(target.to.pos)) {
            bee.target = target.ref;
            let res = this.cell.requests[bee.target].resource;
            bee.state = bee.store.getUsedCapacity() > bee.store.getUsedCapacity(res) ? states.fflush
              : bee.store.getUsedCapacity() === 0 ? states.refill : states.work;
          }
        }
      } else if (bee.state === states.chill) {
        bee.target = null;
        let targets: string[] = [];
        for (let k in this.cell.requests)
          if (this.cell.requests[k].amount > 0
            && (this.cell.requests[k].to.id === this.cell.storage.id || this.cell.requests[k].from.id === this.cell.storage.id))
            targets.push(k);
        if (targets.length) {
          bee.target = targets.reduce((prev, curr) => { return this.cell.requests[curr].priority < this.cell.requests[prev].priority ? curr : prev });
          let res = this.cell.requests[bee.target].resource;
          bee.state = bee.store.getUsedCapacity() > bee.store.getUsedCapacity(res) ? states.fflush
            : bee.store.getUsedCapacity() === 0 ? states.refill : states.work;
        }
      }
    }

    if (this.checkBees()) {
      let order: SpawnOrder = {
        setup: Setups.manager,
        amount: 1,
        priority: 7,
      };
      // desired linear regex from desmos))
      let lvl = this.hive.room.controller!.level;
      order.setup.patternLimit = lvl * lvl * 0.5 - lvl * 4.5 + 15;

      this.wish(order);
    }
  }

  run() {
    let bee = this.manager;
    if (!bee)
      return;

    if (bee.pos.roomName !== this.cell.pos.roomName)
      bee.state = states.chill;
    if (bee.creep.ticksToLive && bee.creep.ticksToLive < 15)
      bee.state = states.fflush;

    if (bee.target) {
      let request: StorageRequest = this.cell.requests[bee.target];
      if (request) {
        if (bee.state === states.refill) {
          if (bee.store.getUsedCapacity(request.resource) >= request.amount)
            bee.state = states.work;
          if (!bee.store.getFreeCapacity(request.resource))
            bee.state = states.work;
          if (bee.store.getUsedCapacity() !== bee.store.getUsedCapacity(request.resource))
            bee.state = states.fflush;
        }
        if (bee.state === states.work) {
          if (bee.store.getUsedCapacity(request.resource) === 0)
            bee.state = states.refill;
        }

        if (bee.state === states.refill) {
          let amountBee = Math.min(bee.store.getFreeCapacity(request.resource),
            (<Store<ResourceConstant, false>>request.from.store).getUsedCapacity(request.resource),
            request.amount - bee.store.getUsedCapacity(request.resource));

          if (amountBee > 0)
            bee.withdraw(request.from, request.resource, amountBee) === OK
        }
        if (bee.state === states.work) {
          let amountBee = Math.min(request.amount,
            bee.store.getUsedCapacity(request.resource),
            (<Store<ResourceConstant, false>>request.to.store).getFreeCapacity(request.resource));

          if (amountBee > 0 && bee.transfer(request.to, request.resource, amountBee) === OK)
            request.amount -= amountBee;
        }
      } else {
        bee.state = states.fflush;
        bee.target = null;
      }
    } else
      bee.state = states.fflush;

    if (bee.state === states.fflush)
      if (bee.creep.store.getUsedCapacity() > 0 && this.cell.storage.store.getFreeCapacity() > 0) {
        let resource = <ResourceConstant>Object.keys(bee.store)[0];
        bee.transfer(this.cell.storage, resource);
      } else
        if (bee.target)
          bee.state = states.refill;
        else
          bee.state = states.chill;

    if (bee.state === states.chill)
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
