// manages the storage if needed
// like from storage to link or terminal
// refill towers?
// refills the respawnCell
import { storageCell, StorageRequest } from "../../cells/stage1/storageCell";

import { Bee } from "../../bee";
import { Setups } from "../../creepSetups";
import { SpawnOrder } from "../../Hive";
import { Master, states } from "../_Master";
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
    if (this.beesAmount && (this.manager && !Apiary.bees[this.manager.ref] || !this.manager))
      this.manager = this.bees[Object.keys(this.bees)[0]];

    let emergencyRequests = _.filter(this.cell.requests, (r) => r.priority < 2);

    if (this.manager && (this.manager.state === states.chill || emergencyRequests.length)
      && this.manager.pos.roomName === this.cell.pos.roomName) {
      if (this.manager.target && this.cell.requests[this.manager.target]) {
        if (emergencyRequests.length && this.cell.requests[this.manager.target].priority > emergencyRequests[0].priority) {
          this.manager.target = emergencyRequests[0].ref;
          let res = this.cell.requests[this.manager.target].resource;
          this.manager.state = this.manager.store.getUsedCapacity() > this.manager.store.getUsedCapacity(res) ? states.fflush
            : this.manager.store.getUsedCapacity() == 0 ? states.refill : states.work;
        }
      } else if (this.manager.state == states.chill) {
        this.manager.target = null;
        let targets: string[] = [];
        for (let k in this.cell.requests)
          if (this.cell.requests[k].amount > 0
            && (this.cell.requests[k].to.id === this.cell.storage.id || this.cell.requests[k].from.id === this.cell.storage.id))
            targets.push(k);
        if (targets.length) {
          this.manager.target = targets.sort((a, b) => this.cell.requests[a].priority - this.cell.requests[b].priority)[0];
          let res = this.cell.requests[this.manager.target].resource;
          this.manager.state = this.manager.store.getUsedCapacity() > this.manager.store.getUsedCapacity(res) ? states.fflush
            : this.manager.store.getUsedCapacity() == 0 ? states.refill : states.work;
        }
      }
    }

    if (this.checkBees()) {
      let order: SpawnOrder = {
        setup: Setups.manager,
        amount: 1,
        priority: 7,
      };

      // desired linear regex from desmos i guess)
      let lvl = this.hive.room.controller!.level;
      order.setup.patternLimit = lvl * lvl * 0.5 - lvl * 4.5 + 15;

      this.wish(order);
    }
  }

  run() {
    if (this.manager) {
      if (this.manager.pos.roomName !== this.cell.pos.roomName)
        this.manager.state = states.chill;
      if (this.manager.creep.ticksToLive && this.manager.creep.ticksToLive < 15)
        this.manager.state = states.fflush;

      if (this.manager.target) {
        let request: StorageRequest = this.cell.requests[this.manager.target];
        if (request) {
          if (this.manager.state === states.refill) {
            if (this.manager.store.getUsedCapacity(request.resource) >= request.amount)
              this.manager.state = states.work;
            if (!this.manager.store.getFreeCapacity(request.resource))
              this.manager.state = states.work;
            if (this.manager.store.getUsedCapacity() != this.manager.store.getUsedCapacity(request.resource))
              this.manager.state = states.fflush;
          }

          if (this.manager.state === states.work) {
            if (this.manager.store.getUsedCapacity(request.resource) === 0)
              this.manager.state = states.refill;
          }

          if (this.cell.requests[this.manager.target]) {
            if (this.manager.state === states.refill) {
              let amountBee = Math.min(this.manager.store.getFreeCapacity(request.resource),
                (<Store<ResourceConstant, false>>request.from.store).getUsedCapacity(request.resource),
                request.amount - this.manager.store.getUsedCapacity(request.resource));

              if (amountBee > 0)
                this.manager.withdraw(request.from, request.resource, amountBee) == OK
            }

            if (this.manager.state === states.work) {
              let amountBee = Math.min(request.amount,
                this.manager.store.getUsedCapacity(request.resource),
                (<Store<ResourceConstant, false>>request.to.store).getFreeCapacity(request.resource));

              if (amountBee > 0 && this.manager.transfer(request.to, request.resource, amountBee) === OK)
                request.amount -= amountBee;
            }
          }
        } else {
          this.manager.state = states.fflush;
          this.manager.target = null;
        }
      } else {
        this.manager.state = states.fflush;
        this.manager.target = null;
      }

      if (this.manager.state === states.fflush) {
        if (this.manager.creep.store.getUsedCapacity() > 0) {
          let resource = <ResourceConstant>Object.keys(this.manager.store)[0];
          this.manager.transfer(this.cell.storage, resource);
        } else
          this.manager.state = states.chill;
      }

      _.forEach(this.bees, (bee) => {
        if (bee.state === states.chill)
          bee.goRest(this.cell.pos);
      });
    }
  }
}
