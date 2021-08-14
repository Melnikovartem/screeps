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

  targetMap: { [id: string]: string } = {};

  constructor(storageCell: storageCell) {
    super(storageCell.hive, storageCell.ref);

    this.cell = storageCell;
  }

  newBee(bee: Bee) {
    super.newBee(bee);
    this.targetMap[bee.ref] = "";
  }

  update() {
    super.update();
    for (let key in this.targetMap)
      if (!Apiary.bees[key])
        delete this.targetMap[key];

    let targets: string[] = [];
    // assigning the orders
    for (let key in this.cell.requests) {
      let request = this.cell.requests[key];
      if ((request.amount == undefined || request.amount >= 25)
        && request.to.id == this.cell.storage.id || request.from.id == this.cell.storage.id
        || (this.cell.terminal && (request.to.id == this.cell.terminal.id || request.from.id == this.cell.terminal.id)))
        targets.push(key);
    }
    targets.sort((a, b) => this.cell.requests[b].priority - this.cell.requests[a].priority);

    for (let key in this.targetMap) {
      if (!targets.length)
        break;
      if (this.targetMap[key] != "" && this.cell.requests[targets[0]].priority != 0)
        continue;


      let target = targets.pop()!
      this.targetMap[key] = target;
    }


    // tragets.length cause dont need a manager for nothing
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
    _.forEach(this.bees, (bee) => {
      let request: StorageRequest = this.cell.requests[this.targetMap[bee.ref]];
      if (request) {
        let usedCapFrom = (<Store<ResourceConstant, false>>request.from.store)[request.resource];
        let freeCapTo = (<Store<ResourceConstant, false>>request.to.store).getFreeCapacity(request.resource);
        let amountBee = bee.store[request.resource];
        request.amount = request.amount != undefined ? request.amount : freeCapTo;
        request.amount = Math.min(freeCapTo, request.amount);

        if (amountBee > 0) {
          let ans = bee.transfer(request.to, request.resource, Math.min(request.amount, amountBee));
          if (ans == OK)
            request.amount -= amountBee;
        }

        if (amountBee == 0 && request.amount > 0) {
          amountBee = Math.min(bee.store.getFreeCapacity(), request.amount);
          amountBee = Math.min(amountBee, usedCapFrom);

          if (amountBee > 0)
            bee.withdraw(request.from, request.resource, amountBee);
        }

        if (request.amount <= 0 || (usedCapFrom == 0 && amountBee == 0)) {
          delete this.cell.requests[this.targetMap[bee.ref]];
          this.targetMap[bee.ref] = "";
        }
      } else {
        this.targetMap[bee.ref] = "";
        let ans;
        if (bee.creep.store.getUsedCapacity() > 0)
          ans = bee.transfer(this.cell.storage, <ResourceConstant>Object.keys(bee.store)[0]);
        if (bee.creep.store.getUsedCapacity() == 0 || ans == OK)
          bee.goRest(this.cell.pos);
      }
    });
  }
}
