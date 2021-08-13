// manages the storage if needed
// like from storage to link or terminal
// refill towers?
// refills the respawnCell
import { storageCell, StorageRequest } from "../../cells/storageCell";

import { Bee } from "../../bee";

import { Setups, CreepSetup } from "../../creepSetups";
import { SpawnOrder } from "../../Hive";
import { Master } from "../_Master";

export class managerMaster extends Master {
  cell: storageCell;

  targetMap: { [id: string]: string } = {};

  idlePos: RoomPosition;

  constructor(storageCell: storageCell) {
    super(storageCell.hive, "master_" + storageCell.ref);

    this.cell = storageCell;

    let flags = _.filter(this.hive.room.find(FIND_FLAGS), (flag) => flag.color == COLOR_CYAN && flag.secondaryColor == COLOR_YELLOW);
    if (flags.length)
      this.idlePos = flags[0].pos;
    else
      this.idlePos = storageCell.storage.pos;
  }

  newBee(bee: Bee) {
    super.newBee(bee);
    this.targetMap[bee.ref] = "";
  }

  update() {
    super.update();
    for (let key in this.targetMap)
      if (!global.bees[key])
        delete this.targetMap[key];

    let targets: string[] = [];
    // assigning the orders
    for (let key in this.cell.requests) {
      let request = this.cell.requests[key];
      if (request.to.id == this.cell.storage.id || request.from.id == this.cell.storage.id
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
        priority: 3,
      };

      if (this.hive.cells.storageCell && this.hive.cells.storageCell.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 200000) {
        order.setup = <CreepSetup>{ ...Setups.manager };
        order.setup.bodySetup.patternLimit = 5; // save energy from burning
      }

      this.wish(order);
    }
  }

  run() {
    // TODO smarter choosing of target
    // aka draw energy if there is a target and otherwise put it back
    _.forEach(this.bees, (bee) => {
      let request: StorageRequest = this.cell.requests[this.targetMap[bee.ref]];
      if (request) {
        let usedCapFrom = (<Store<ResourceConstant, false>>request.from.store)[request.resource];
        let freeCapTo = (<Store<ResourceConstant, false>>request.to.store).getFreeCapacity(request.resource);
        let amount = bee.store[request.resource];
        if (amount == 0) {
          amount = bee.store.getFreeCapacity();
          if (request.amount != undefined)
            amount = Math.min(amount, request.amount);

          amount = Math.min(amount, usedCapFrom);

          if (amount > 0) {
            bee.withdraw(request.from, request.resource, amount);
            amount = 0;
          }
        }

        if (amount > 0) {
          amount = Math.min(bee.store[request.resource], freeCapTo);
          if (bee.transfer(request.to, request.resource, amount) == OK) {
            if (request.amount)
              request.amount -= amount;
            else
              request.amount = freeCapTo - amount;
          }
        }

        if ((request.amount != undefined && request.amount <= 0) || (usedCapFrom == 0 && amount == 0) || freeCapTo == 0) {
          delete this.cell.requests[this.targetMap[bee.ref]];
          this.targetMap[bee.ref] = "";
        }
      } else {
        this.targetMap[bee.ref] = "";
        if (bee.creep.store.getUsedCapacity() > 0)
          bee.transfer(this.cell.storage, <ResourceConstant>Object.keys(bee.store)[0]);
        else
          bee.goRest(this.idlePos);
      }
    });
  }
}
