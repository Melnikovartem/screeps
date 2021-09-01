// manages the storage if needed
// like from storage to link or terminal
// refill towers?
// refills the respawnCell
import { storageCell, StorageRequest } from "../../cells/stage1/storageCell";

import { Bee } from "../../bee";
import { Setups, CreepSetup } from "../../creepSetups";
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

    if (this.manager && (this.manager.state == states.chill || emergencyRequests.length)
      && this.manager.pos.roomName == this.cell.pos.roomName) {
      if (emergencyRequests.length) {
        this.manager.target = emergencyRequests[0].ref;
      } else {
        let targets: string[] = [];
        for (let k in this.cell.requests)
          if (this.cell.requests[k].to[0].id == this.cell.storage.id || this.cell.requests[k].from[0].id == this.cell.storage.id)
            targets.push(k);
        this.manager.target = targets.sort((a, b) => this.cell.requests[a].priority - this.cell.requests[b].priority)[0];
      }

      let request = this.cell.requests[this.manager.target];
      if (request) {
        if (_.sum(request.amount) > 0) {
          if (_.sum(request.resource, (res) => this.manager!.store[<ResourceConstant>res]) > 0)
            this.manager.state = states.work;
          else
            this.manager.state = states.refill;
        } else
          delete this.cell.requests[this.manager.target];
      }
    }

    if (this.checkBees()) {
      let order: SpawnOrder = {
        setup: new CreepSetup(Setups.manager.name, { ...Setups.manager.bodySetup }),
        amount: 1,
        priority: 7,
      };

      // desired linear regex from desmos i guess)
      let lvl = this.hive.room.controller!.level;
      order.setup.bodySetup.patternLimit = lvl * lvl * 0.5 - lvl * 4.5 + 15;

      this.wish(order);
    }
  }

  run() {
    if (this.manager) {
      if (this.manager.pos.roomName != this.cell.pos.roomName)
        this.manager.state = states.chill;
      if (this.manager.creep.ticksToLive && this.manager.creep.ticksToLive < 15)
        this.manager.state = states.fflush;
      if (!this.manager.target)
        this.manager.state = states.fflush;

      if (this.manager.target) {
        let request: StorageRequest = this.cell.requests[this.manager.target];
        if (request) {
          let current = 0;
          if (this.manager.state == states.refill) {
            while (request.resource.length - 1 > current && request.from[current].store[request.resource[current]] == 0)
              current += 1;

            if (this.manager.store.getUsedCapacity(request.resource[current]) >= _.sum(request.amount))
              this.manager.state = states.work;
            if (this.manager.store.getFreeCapacity(request.resource[current]) == 0)
              this.manager.state = states.work;
            if (this.manager.store.getFreeCapacity(request.resource[current]) == 0 && this.manager.store[request.resource[current]] == 0)
              this.manager.state = states.fflush;

            if (request.from[current].store[request.resource[current]] == 0
              && this.manager.store[request.resource[current]] == 0 && this.manager.state == states.refill)
              delete this.cell.requests[this.manager.target];
          }

          if (this.manager.state == states.work) {
            while (request.resource.length - 1 > current && this.manager.store[request.resource[current]] > request.amount[current])
              current += 1;

            if (this.manager.store.getUsedCapacity(request.resource[current]) == 0)
              this.manager.state = states.refill;


            if (_.sum(request.amount) <= 0)
              delete this.cell.requests[this.manager.target];
            // invalidate request
            else if (_.sum(request.to, (t, k) => (<Store<ResourceConstant, false>>t.store).getFreeCapacity(request.resource[k])) == 0)
              delete this.cell.requests[this.manager.target];
          }

          if (this.cell.requests[this.manager.target]) {
            if (this.manager.state == states.refill) {
              let amountBee = Math.min(this.manager.store.getFreeCapacity(request.resource[current]),
                request.from[current].store[request.resource[current]],
                request.amount[current] - this.manager.store.getUsedCapacity(request.resource[current]));

              if (amountBee > 0)
                this.manager.withdraw(request.from[current], request.resource[current], amountBee);
            }

            if (this.manager.state == states.work) {
              let amountBee = Math.min(request.amount[current], this.manager.store[request.resource[current]],
                (<Store<ResourceConstant, false>>request.to[current].store).getFreeCapacity(request.resource[current]));

              if (amountBee > 0 && this.manager.transfer(request.to[current], request.resource[current], amountBee) == OK)
                request.amount[current] -= amountBee;
            }
          }
        } else {
          this.manager.state = states.fflush;
          this.manager.target = null;
        }
      }

      if (this.manager.state == states.fflush) {
        if (this.manager.creep.store.getUsedCapacity() > 0) {
          let resource = <ResourceConstant>Object.keys(this.manager.store)[0];
          this.manager.transfer(this.cell.storage, resource);
        } else
          this.manager.state = states.chill;
      }

      _.forEach(this.bees, (bee) => {
        if (bee.state == states.chill)
          bee.goRest(this.cell.pos);
      });
    }
  }
}
