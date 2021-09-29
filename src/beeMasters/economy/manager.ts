import { Master } from "../_Master";

import { beeStates } from "../../enums";
import { setups } from "../../bees/creepsetups";
import { findOptimalResource } from "../../abstract/utils";

import { profile } from "../../profiler/decorator";
import type { StorageCell } from "../../cells/stage1/storageCell";
import type { TransferRequest } from "../../bees/transferRequest";

@profile
export class ManagerMaster extends Master {
  cell: StorageCell;
  movePriority = <3>3;

  constructor(storageCell: StorageCell) {
    super(storageCell.hive, storageCell.ref);
    this.cell = storageCell;
  }

  update() {
    super.update();

    _.forEach(this.activeBees, bee => {
      let transfer = bee.target && this.cell.requests[bee.target];

      if (transfer)
        transfer.preprocess(bee);

      if ((!transfer || !transfer.isValid())) {
        delete bee.target;
        if (Object.keys(this.cell.requests).length && bee.creep.ticksToLive! > 20) {
          let beeRes = bee.store.getUsedCapacity() > 0 && findOptimalResource(bee.store);
          transfer = _.reduce(_.filter(this.cell.requests, r => r.isValid())
            , (prev: TransferRequest, curr) => {
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
          transfer.preprocess(bee);
        }
      }
    });


    if (this.checkBees(true)) {
      let order = {
        setup: setups.queen,
        amount: 1,
        priority: <0>0,
      };

      let lvl = this.hive.room.controller!.level;
      // some cool function i came up with. It works utill lvl 8 though
      order.setup.patternLimit = Math.ceil(0.042 * Math.pow(lvl, 3) + 11.2);

      this.wish(order);
    }
  }

  run() {
    _.forEach(this.activeBees, bee => {
      if (bee.pos.roomName !== this.cell.pos.roomName)
        bee.state = beeStates.chill;
      if (bee.creep.ticksToLive && bee.creep.ticksToLive < 10)
        bee.state = beeStates.fflush;

      let transfer = bee.target && this.cell.requests[bee.target];

      if (bee.state === beeStates.fflush)
        if (bee.creep.store.getUsedCapacity() > 0 && this.cell.storage.store.getFreeCapacity() > 0)
          bee.transfer(this.cell.storage, findOptimalResource(bee.store));
        else
          if (transfer)
            bee.state = beeStates.refill;
          else
            bee.state = beeStates.chill;

      if (transfer)
        transfer.process(bee);
      else if (bee.creep.store.getUsedCapacity() > 0)
        bee.state = beeStates.fflush;

      if (bee.state === beeStates.chill) {
        let pos = this.hive.getPos("queen2");
        if (pos.x !== bee.pos.x || pos.y !== bee.pos.y)
          if (pos.isFree())
            bee.goRest(pos);
          else
            bee.goRest(this.hive.getPos("queen1"));
      }
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
