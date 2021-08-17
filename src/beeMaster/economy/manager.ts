// manages the storage if needed
// like from storage to link or terminal
// refill towers?
// refills the respawnCell
import { storageCell, StorageRequest } from "../../cells/stage1/storageCell";

import { Bee } from "../../bee";
import { Setups, CreepSetup } from "../../creepSetups";
import { SpawnOrder } from "../../Hive";
import { Master } from "../_Master";
import { profile } from "../../profiler/decorator";

@profile
export class managerMaster extends Master {
  cell: storageCell;

  manager: Bee | undefined;
  state: "to" | "from" | "chill" | "fflush" = "chill";
  target: string = "";

  constructor(storageCell: storageCell) {
    super(storageCell.hive, storageCell.ref);

    this.cell = storageCell;
  }

  update() {
    super.update();
    if (this.beesAmount && (this.manager && !Apiary.bees[this.manager.ref] || !this.manager)) {
      this.manager = this.bees[Object.keys(this.bees)[0]];
      this.target = "";
      this.state = "chill";
    }

    let emergencyRequests = _.filter(this.cell.requests, (r) => r.priority < 2);

    if (this.manager && (this.state == "chill" || emergencyRequests.length)) {
      if (emergencyRequests.length) {
        this.target = emergencyRequests[0].ref;
      } else {
        let targets: string[] = [];
        for (let k in this.cell.requests) {
          let request = this.cell.requests[k];
          if ((request.amount == undefined || request.amount >= 25 || request.resource != RESOURCE_ENERGY)
            && _.sum(request.from, (s) => s.store[request.resource]) >= (request.amount ? request.amount : 0)
            && request.to[0].id == this.cell.storage.id || request.from[0].id == this.cell.storage.id)
            targets.push(k);
        }
        this.target = targets.sort((a, b) => this.cell.requests[b].priority - this.cell.requests[a].priority)[0];
      }

      let request = this.cell.requests[this.target];
      if (request) {
        request.amount = request.amount != undefined ? request.amount :
          Math.min(_.sum(request.to, (s) => (<Store<ResourceConstant, false>>s.store).getFreeCapacity(request.resource)),
            _.sum(request.from, (s) => s.store[request.resource]));
        if (request.amount > 0) {
          if (this.manager.store[request.resource] > 0)
            this.state = "to";
          else
            this.state = "from";
        } else
          delete this.cell.requests[this.target];
      }
    }

    if (this.checkBees()) {
      let order: SpawnOrder = {
        master: this.ref,
        setup: Setups.manager,
        amount: 1,
        priority: 6,
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
        this.state = "fflush";
      if (this.cell.requests[this.target]) {
        let request: StorageRequest = this.cell.requests[this.target];
        request.amount = request.amount != undefined ? request.amount :
          Math.min(_.sum(request.to, (s) => (<Store<ResourceConstant, false>>s.store).getFreeCapacity(request.resource)),
            _.sum(request.from, (s) => s.store[request.resource])) + this.manager.store[request.resource];
        if (this.state == "from") {
          while (request.from.length > 1 && request.from[0].store[request.resource] == 0)
            request.from.shift();

          if (this.manager.store[request.resource] >= request.amount)
            this.state = "to";

          if (this.manager.store.getFreeCapacity(request.resource) == 0)
            this.state = "to";

          if (this.manager.store.getFreeCapacity(request.resource) == 0 && this.manager.store[request.resource] == 0)
            this.state = "fflush";

          if (request.from[0].store[request.resource] == 0 && this.manager.store[request.resource] == 0 && this.state == "from")
            delete this.cell.requests[this.target];

        } else if (this.state == "to") {
          while (request.to.length > 1 && (<Store<ResourceConstant, false>>request.to[0].store).getFreeCapacity(request.resource) == 0)
            request.to.shift();

          if (this.manager.store[request.resource] == 0)
            this.state = "from";

          if ((<Store<ResourceConstant, false>>request.to[0].store).getFreeCapacity(request.resource) == 0)
            delete this.cell.requests[this.target];
        }
        if (this.cell.requests[this.target]) {
          if (this.state == "from") {
            let amountBee = Math.min(this.manager.store.getFreeCapacity(request.resource),
              request.from[0].store[request.resource], request.amount - this.manager.store[request.resource]);

            if (amountBee > 0)
              this.manager.withdraw(request.from[0], request.resource, amountBee);
          } else if (this.state == "to") {
            let amountBee = Math.min(request.amount, this.manager.store[request.resource],
              (<Store<ResourceConstant, false>>request.to[0].store).getFreeCapacity(request.resource));

            if (amountBee > 0 && this.manager.transfer(request.to[0], request.resource, amountBee) == OK)
              request.amount -= amountBee;

            if (request.amount <= 0)
              delete this.cell.requests[this.target];
          }
        }
      } else
        this.state = "fflush";

      if (this.state == "fflush") {
        if (this.manager.creep.store.getUsedCapacity() > 0) {
          for (let res in this.manager.store)
            this.manager.transfer(this.cell.storage, <ResourceConstant>res);
        } else
          this.state = "chill";
      }

      if (this.state == "chill")
        this.manager.goRest(this.cell.pos);


      _.forEach(this.bees, (bee) => {
        if (bee.ref != this.manager!.ref)
          bee.goRest(this.cell.pos);
      });
    }
  }
}
