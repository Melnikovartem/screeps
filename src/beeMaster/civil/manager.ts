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
  state: "to" | "from" | "chill" = "chill";
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
        // console.log(this.manager.creep, this.target, request.amount, request.resource, this.state, "\nfrom", request.from, "\nto", request.to);
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
      if (this.cell.requests[this.target] && this.state != "chill") {
        let request: StorageRequest = this.cell.requests[this.target];
        request.amount = request.amount != undefined ? request.amount : _.sum(request.to, (s) => s.store[request.resource]);
        if (this.state == "from") {
          let ans;
          let usedCapFrom = request.from[0].store[request.resource];
          if (request.from.length > 1 && usedCapFrom == 0) {
            request.from.shift();
            usedCapFrom = request.from[0].store[request.resource];
          }

          // prob should add some
          let amountBee = Math.min(this.manager.store.getFreeCapacity(request.resource),
            usedCapFrom, request.amount - this.manager.store[request.resource]);

          if (amountBee > 0)
            ans = this.manager.withdraw(request.from[0], request.resource, amountBee);

          if (ans == OK && !request.multipleFrom)
            this.state = "to";

          if (ans == OK && request.multipleFrom && request.from.length == 1)
            this.state = "to";

          if (this.manager.store.getFreeCapacity(request.resource) == 0)
            this.state = "to";

          if (this.manager.store[request.resource] >= request.amount)
            this.state = "to";

          if (this.manager.store[request.resource] == 0 && this.manager.store.getFreeCapacity(request.resource) == 0)
            this.state = "chill";

          if (request.from.length == 1 && usedCapFrom == 0 && this.state == "from")
            delete this.cell.requests[this.target];
        }

        if (this.state == "to") {
          let ans;
          let freeCapTo = (<Store<ResourceConstant, false>>request.to[0].store).getFreeCapacity(request.resource);
          if (request.to.length > 1 && freeCapTo == 0) {
            request.to.shift();
            freeCapTo = (<Store<ResourceConstant, false>>request.to[0].store).getFreeCapacity(request.resource);
          }

          let amountBee = Math.min(request.amount, this.manager.store[request.resource], freeCapTo);

          if (amountBee > 0)
            ans = this.manager.transfer(request.to[0], request.resource, amountBee);

          if (ans == OK)
            request.amount -= amountBee;

          if (ans == OK && this.manager.store[request.resource] - amountBee == 0)
            this.state = "from";

          if (this.manager.store[request.resource] == 0)
            this.state = "from";

          if (request.to.length == 1 && freeCapTo == 0 && this.state == "to")
            delete this.cell.requests[this.target];
        }

        if (request.amount == 0)
          delete this.cell.requests[this.target];
      }

      if (this.state == "chill") {
        let ans;
        if (this.manager.creep.store.getUsedCapacity() > 0) {
          if (!this.manager.pos.isNearTo(this.cell.storage))
            this.manager.goTo(this.cell.storage);
          else
            for (let res in this.manager.store)
              ans = this.manager.transfer(this.cell.storage, <ResourceConstant>res);
        }
        if (this.manager.creep.store.getUsedCapacity() == 0 || ans == OK)
          this.manager.goRest(this.cell.pos);
      }

      if (!this.cell.requests[this.target])
        this.state = "chill";

      _.forEach(this.bees, (bee) => {
        if (bee.ref != this.manager!.ref)
          bee.goRest(this.cell.pos);
      });
    }
  }
}
