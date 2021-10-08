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
  targetBeeCount = 2;

  constructor(storageCell: StorageCell) {
    super(storageCell.hive, storageCell.ref);
    this.cell = storageCell;
  }

  update() {
    super.update();

    this.activeBees.sort((a, b) => a.pos.getRangeTo(this.cell) - b.pos.getRangeTo(this.cell));

    let refilling = 0;
    _.forEach(this.activeBees, bee => {
      let transfer = bee.target && this.cell.requests[bee.target];
      if (transfer) {
        transfer.preprocess(bee);
        if (!transfer.priority)
          ++refilling;
      }
    });

    let requests: TransferRequest[] | { [id: string]: TransferRequest } = this.cell.requests;
    let non_refill_needed = refilling > 1;
    if (non_refill_needed) {
      let non_refill_requests = _.filter(requests, r => r.priority);
      if (non_refill_requests.length) {
        this.activeBees.sort((a, b) => a.pos.getRangeTo(this.cell.pos) - b.pos.getRangeTo(this.cell.pos));
        requests = non_refill_requests;
      } else
        non_refill_needed = false;
    }

    _.forEach(this.activeBees, bee => {
      let transfer = bee.target && this.cell.requests[bee.target];

      if (!transfer || !transfer.isValid() || (non_refill_needed && !transfer.priority)) {
        delete bee.target;
        if (Object.keys(requests).length && bee.ticksToLive > 20) {
          let beeRes = bee.store.getUsedCapacity() > 0 && findOptimalResource(bee.store);
          transfer = _.reduce(_.filter(requests, (r: TransferRequest) => r.isValid() && !r.beeProcess)
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
              if (!ans)
                ans = Math.random() - 0.5;
              return ans < 0 ? curr : prev;
            });
          if (transfer)
            transfer.preprocess(bee);
          if (non_refill_needed) {
            requests = this.cell.requests;
            non_refill_needed = false;
          }
        }
      }
    });


    if (this.checkBees(true) && this.cell.storage.store.getUsedCapacity(RESOURCE_ENERGY)) {
      let order = {
        setup: setups.queen,
        priority: <0>0,
      };

      let lvl = this.hive.room.controller!.level;
      // some cool function i came up with. It works utill lvl 8 though
      order.setup.patternLimit = Math.round(0.027 * Math.pow(lvl, 3) + 10.2);

      this.wish(order);
    }
  }

  run() {
    _.forEach(this.activeBees, bee => {
      if (bee.pos.roomName !== this.cell.pos.roomName)
        bee.state = beeStates.chill;
      if (bee.ticksToLive < 10)
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
        let poss = [this.hive.getPos("queen1"), this.hive.getPos("queen2")];
        let shouldMove = true
        _.forEach(poss, p => {
          if (p.x === bee.pos.x && p.y === bee.pos.y)
            shouldMove = false;
        });
        if (shouldMove) {
          let pos = poss.filter(p => p.isFree())[0];
          if (pos)
            bee.goRest(pos);
        }
      }
    });
  }
}
