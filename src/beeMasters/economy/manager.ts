import { Master } from "../_Master";

import { beeStates, hiveStates } from "../../enums";
import { setups } from "../../bees/creepsetups";
import { findOptimalResource } from "../../abstract/utils";

import { profile } from "../../profiler/decorator";
import type { StorageCell } from "../../cells/stage1/storageCell";
import type { SpawnOrder } from "../../Hive";
import type { Bee } from "../../bees/bee";
import type { TransferRequest } from "../../bees/transferRequest";

@profile
export class ManagerMaster extends Master {
  cell: StorageCell;
  manager: Bee | undefined;
  movePriority = <3>3;

  constructor(storageCell: StorageCell) {
    super(storageCell.hive, storageCell.ref);
    this.cell = storageCell;
  }

  update() {
    super.update();

    if (this.checkBees(this.hive.state === hiveStates.lowenergy)) {
      let order: SpawnOrder = {
        setup: setups.manager,
        amount: 1,
        priority: 1,
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

    _.forEach(this.activeBees, bee => {
      if (!bee.target || !this.cell.requests[bee.target] || !this.cell.requests[bee.target].isValid() && Object.keys(this.cell.requests).length) {
        let beeRes = bee.store.getUsedCapacity() > 0 && findOptimalResource(bee.store);
        let req = _.reduce(this.cell.requests, (prev: TransferRequest, curr) => {
          let ans = curr.priority - prev.priority;
          if (!ans) {
            let refPoint = curr.resource === beeRes ? bee.pos : this.cell.storage.pos;
            let nonStoragePrev = prev.to.id === this.cell.storage.id ? prev.from : prev.to;
            let nonStorageCurr = curr.to.id === this.cell.storage.id ? curr.from : curr.to;
            ans = refPoint.getRangeTo(nonStorageCurr) - refPoint.getRangeTo(nonStoragePrev);
          }
          if (!ans)
            ans = curr.amount - prev.amount;
          return ans < 0 ? curr : prev;
        });
        bee.target = req.ref;
        bee.state = bee.store.getUsedCapacity() > bee.store.getUsedCapacity(req.resource) ? beeStates.fflush
          : bee.store.getUsedCapacity() === 0 ? beeStates.refill : beeStates.work;
      }
    });
  }

  run() {
    _.forEach(this.activeBees, bee => {
      if (bee.pos.roomName !== this.cell.pos.roomName)
        bee.state = beeStates.chill;
      if (bee.creep.ticksToLive && bee.creep.ticksToLive < 10)
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

      if (bee.target) {
        let transfer = this.cell.requests[bee.target];
        if (bee.target)
          transfer.process(bee);
      } else
        bee.state = beeStates.fflush;


      if (bee.state === beeStates.chill)
        bee.goRest(this.cell.pos);
    });

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
