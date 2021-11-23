import { Master } from "../_Master";

import { beeStates, hiveStates } from "../../enums";
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
    let pickingup = 0;
    _.forEach(this.activeBees, bee => {
      let transfer = bee.target && this.cell.requests[bee.target];
      if (transfer && !transfer.beeProcess) {
        transfer.preprocess(bee);
        if (transfer.priority === 0 && transfer.isValid())
          ++refilling;
        else if (transfer.priority === 6 && transfer.isValid())
          ++pickingup;
      } else
        bee.target = undefined;
    });

    let requests = _.map(this.cell.requests, r => r);
    if (this.hive.state === hiveStates.lowenergy)
      requests = _.filter(requests, r => r.resource !== RESOURCE_ENERGY || r.priority <= 1 || r.to.id === this.cell.storage.id);

    let non_refill_needed = false;
    if (refilling > 1) {
      let non_refill_requests = _.filter(requests, (r: TransferRequest) => r.priority > 0 && r.priority < 5);
      non_refill_needed = !!non_refill_requests.length;

      if (non_refill_needed) {
        this.activeBees.sort((a, b) => a.pos.getRangeTo(this.cell.pos) - b.pos.getRangeTo(this.cell.pos));
        requests = non_refill_requests;
      }
    }

    _.forEach(this.activeBees, bee => {
      let transfer = bee.target && this.cell.requests[bee.target];
      if (!transfer || !transfer.isValid() || (non_refill_needed && transfer.priority === 0)
        || (transfer.priority === 2 && this.hive.state === hiveStates.battle && transfer.toAmount < 20)) {
        bee.target = undefined;
        if (Object.keys(requests).length && bee.ticksToLive > 20) {
          let beeRequests = _.filter(requests, (r) => r.isValid(bee.store.getUsedCapacity(r.resource)) && !r.beeProcess && (r.priority < 6 || !pickingup));
          if (!beeRequests.length)
            return;
          let newTransfer = _.reduce(beeRequests
            , (prev: TransferRequest, curr) => {
              let ans = curr.priority - prev.priority;
              if (!ans) {
                let refPoint = bee.store.getUsedCapacity(curr.resource) >= curr.amount ? bee.pos : this.cell.storage.pos;
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
          newTransfer.preprocess(bee);
          if (transfer && transfer.priority === 0) {
            --refilling;
            requests = _.map(this.cell.requests, r => r);
            non_refill_needed = false;
          }
        }
      }
    });


    if (this.checkBees(true)) {
      let setup = setups.queen;
      let lvl = this.hive.controller.level;
      // some cool function i came up with. It works utill lvl 8 though
      setup.patternLimit = Math.ceil(0.02 * Math.pow(lvl, 3) + 0.4 * lvl + 12);

      if (this.hive.state === hiveStates.lowenergy)
        setup.patternLimit = Math.ceil(setup.patternLimit / 2);

      this.wish({
        setup: setup,
        priority: 0,
      });
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

      if (transfer) {
        if (!transfer.process(bee) && !transfer.priority && bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
          let ss = (<(StructureSpawn | StructureExtension)[]>bee.pos.findInRange(FIND_MY_STRUCTURES, 1)
            .filter(s => s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN))
            .filter(s => s.store.getFreeCapacity(RESOURCE_ENERGY))[0];
          if (ss)
            bee.transfer(ss, RESOURCE_ENERGY);
        }
      } else if (bee.creep.store.getUsedCapacity() > 0)
        bee.state = beeStates.fflush;

      if (bee.state === beeStates.chill) {
        let poss = [this.hive.getPos("queen1"), this.hive.getPos("queen2")];
        let shouldMove = true
        _.forEach(poss, p => {
          if (p.equal(bee))
            shouldMove = false;
        });
        if (shouldMove) {
          let pos = poss.filter(p => p.isFree())[0];
          if (pos)
            bee.goRest(pos);
        }
      }
      this.checkFlee(bee);
    });
  }
}
