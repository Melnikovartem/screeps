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

    if (this.manager && (this.manager.state == states.chill || emergencyRequests.length)) {
      if (emergencyRequests.length) {
        this.manager.target = emergencyRequests[0].ref;
      } else {
        let targets: string[] = [];
        for (let k in this.cell.requests) {
          let request = this.cell.requests[k];
          if ((request.amount == undefined || request.amount >= 25 || request.resource != RESOURCE_ENERGY)
            && _.sum(request.from, (s) => s.store[request.resource]) >= (request.amount ? request.amount : 0)
            && request.to[0].id == this.cell.storage.id || request.from[0].id == this.cell.storage.id)
            targets.push(k);
        }
        this.manager.target = targets.sort((a, b) => this.cell.requests[b].priority - this.cell.requests[a].priority)[0];
      }

      let request = this.cell.requests[this.manager.target];
      if (request) {
        request.amount = request.amount != undefined ? request.amount :
          Math.min(_.sum(request.to, (s) => (<Store<ResourceConstant, false>>s.store).getFreeCapacity(request.resource)),
            _.sum(request.from, (s) => s.store[request.resource]));
        if (request.amount > 0) {
          if (this.manager.store[request.resource] > 0)
            this.manager.state = states.work;
          else
            this.manager.state = states.refill;
        } else
          delete this.cell.requests[this.manager.target];
      }
    }

    if (this.checkBees()) {
      let order: SpawnOrder = {

        setup: Setups.manager,
        amount: 1,
        priority: 7,
      };

      if (this.cell.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 200000) {
        order.setup = new CreepSetup(Setups.manager.name, { ...Setups.manager.bodySetup });
        order.setup.bodySetup.patternLimit = 5; // save energy from burning
      }

      this.wish(order);
    }
  }

  run() {
    if (this.manager) {
      if (this.manager.creep.ticksToLive && this.manager.creep.ticksToLive < 15)
        this.manager.state = states.fflush;
      if (!this.manager.target)
        this.manager.state = states.fflush;

      if (this.manager.target) {
        let request: StorageRequest = this.cell.requests[this.manager.target];
        if (request) {
          request.amount = request.amount != undefined ? request.amount :
            Math.min(_.sum(request.to, (s) => (<Store<ResourceConstant, false>>s.store).getFreeCapacity(request.resource)),
              _.sum(request.from, (s) => s.store[request.resource]));

          if (this.manager.state == states.refill) {
            while (request.from.length > 1 && request.from[0].store[request.resource] == 0)
              request.from.shift();

            if (this.manager.store[request.resource] >= request.amount)
              this.manager.state = states.work;
            if (this.manager.store.getFreeCapacity(request.resource) == 0)
              this.manager.state = states.work;
            if (this.manager.store.getFreeCapacity(request.resource) == 0 && this.manager.store[request.resource] == 0)
              this.manager.state = states.fflush;

            if (request.from[0].store[request.resource] == 0 && this.manager.store[request.resource] == 0 && this.manager.state == states.refill)
              delete this.cell.requests[this.manager.target];
            else if (this.manager.state == states.refill)
              this.manager.state = states.work;
          } else if (this.manager.state == states.work) {
            while (request.to.length > 1 && (<Store<ResourceConstant, false>>request.to[0].store).getFreeCapacity(request.resource) == 0)
              request.to.shift();

            if (this.manager.store[request.resource] == 0)
              this.manager.state = states.refill;

            if ((<Store<ResourceConstant, false>>request.to[0].store).getFreeCapacity(request.resource) == 0)
              delete this.cell.requests[this.manager.target];
          }

          if (this.cell.requests[this.manager.target]) {
            if (this.manager.state == states.refill) {
              let amountBee = Math.min(this.manager.store.getFreeCapacity(request.resource),
                request.from[0].store[request.resource], request.amount - this.manager.store[request.resource]);

              if (amountBee > 0)
                this.manager.withdraw(request.from[0], request.resource, amountBee);
            } else if (this.manager.state == states.work) {
              let amountBee = Math.min(request.amount, this.manager.store[request.resource],
                (<Store<ResourceConstant, false>>request.to[0].store).getFreeCapacity(request.resource));

              if (amountBee > 0 && this.manager.transfer(request.to[0], request.resource, amountBee) == OK)
                request.amount -= amountBee;

              if (request.amount <= 0)
                delete this.cell.requests[this.manager.target];
            }
          }
        } else
          this.manager.state = states.fflush;
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
