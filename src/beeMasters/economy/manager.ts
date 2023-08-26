import { setups } from "../../bees/creepSetups";
import type { TransferRequest } from "../../bees/transferRequest";
import type { StorageCell } from "../../cells/stage1/storageCell";
import { profile } from "../../profiler/decorator";
import { beeStates, hiveStates } from "../../static/enums";
import { findOptimalResource } from "../../static/utils";
import { Master } from "../_Master";

@profile
export class ManagerMaster extends Master {
  private cell: StorageCell;
  public movePriority = 3 as const;

  public constructor(storageCell: StorageCell) {
    super(storageCell.hive, storageCell.ref);
    this.targetBeeCount = 2;
    this.cell = storageCell;
  }

  public update() {
    super.update();

    this.activeBees.sort(
      (a, b) => a.pos.getRangeTo(this.cell) - b.pos.getRangeTo(this.cell)
    );

    let refilling = 0;
    let pickingup = 0;
    _.forEach(this.activeBees, (bee) => {
      const transfer = bee.target && this.cell.requests[bee.target];
      if (transfer && !transfer.beeProcess) {
        transfer.preprocess(bee);
        if (transfer.priority === 0 && transfer.isValid()) ++refilling;
        else if (transfer.priority === 6 && transfer.isValid()) ++pickingup;
      } else bee.target = undefined;
    });

    let requests = _.map(this.cell.requests, (r) => r);
    if (this.hive.state === hiveStates.lowenergy)
      requests = _.filter(
        requests,
        (r) =>
          r.resource !== RESOURCE_ENERGY ||
          r.priority <= 1 ||
          r.to.id === this.cell.storage.id
      );

    let nonRefillNeeded = false;
    if (refilling > 1) {
      const nonRefillRequests = _.filter(
        requests,
        (r: TransferRequest) => r.priority > 0 && r.priority < 5
      );
      nonRefillNeeded = !!nonRefillRequests.length;

      if (nonRefillNeeded) {
        this.activeBees.sort(
          (a, b) =>
            a.pos.getRangeTo(this.cell.pos) - b.pos.getRangeTo(this.cell.pos)
        );
        requests = nonRefillRequests;
      }
    }

    _.forEach(this.activeBees, (bee) => {
      const transfer = bee.target && this.cell.requests[bee.target];
      if (
        !transfer ||
        !transfer.isValid() ||
        (nonRefillNeeded && transfer.priority === 0) ||
        (transfer.priority === 2 &&
          this.hive.state >= hiveStates.battle &&
          transfer.toAmount < 20)
      ) {
        bee.target = undefined;
        if (Object.keys(requests).length && bee.ticksToLive > 20) {
          const beeRequests = _.filter(
            requests,
            (r) =>
              r.isValid(bee.store.getUsedCapacity(r.resource)) &&
              !r.beeProcess &&
              (r.priority < 6 || !pickingup)
          );
          if (!beeRequests.length) return;
          const newTransfer = _.reduce(
            beeRequests,
            (prev: TransferRequest, curr) => {
              let ans = curr.priority - prev.priority;
              if (!ans) {
                const refPoint =
                  bee.store.getUsedCapacity(curr.resource) >= curr.amount
                    ? bee.pos
                    : this.cell.storage.pos;
                const nonStoragePrev =
                  prev.to.id === this.cell.storage.id ? prev.from : prev.to;
                const nonStorageCurr =
                  curr.to.id === this.cell.storage.id ? curr.from : curr.to;
                ans =
                  refPoint.getRangeTo(nonStorageCurr) -
                  refPoint.getRangeTo(nonStoragePrev);
                if (Math.abs(ans) < 3)
                  ans = (prev.nextup ? 1 : 0) - (curr.nextup ? 1 : 0);
              }
              if (!ans) ans = curr.amount - prev.amount;
              if (!ans) ans = Math.random() - 0.5;
              return ans < 0 ? curr : prev;
            }
          );
          newTransfer.preprocess(bee);
          if (transfer && transfer.priority === 0) {
            --refilling;
            requests = _.map(this.cell.requests, (r) => r);
            nonRefillNeeded = false;
          }
          if (newTransfer.priority === 6) ++pickingup;
        }
      }
    });

    if (this.checkBees(true)) {
      const setup = setups.queen;
      const lvl = this.hive.controller.level;
      // some cool function i came up with. It works utill lvl 8 though

      setup.patternLimit = Math.round(
        -0.004 * Math.pow(lvl, 3) + 1.8 * lvl + 8
      );

      if (this.hive.state === hiveStates.lowenergy)
        setup.patternLimit = Math.ceil(setup.patternLimit / 2);

      this.wish({
        setup,
        priority: 0,
      });
    }
  }

  public run() {
    _.forEach(this.activeBees, (bee) => {
      if (this.hive.cells.defense.timeToLand < 50 && bee.ticksToLive > 50) {
        bee.fleeRoom(this.hive.roomName, this.hive.opt);
        return;
      }

      if (bee.pos.roomName !== this.cell.pos.roomName)
        bee.state = beeStates.chill;
      if (bee.ticksToLive < 10) bee.state = beeStates.fflush;

      const transfer = bee.target && this.cell.requests[bee.target];

      if (bee.state === beeStates.fflush)
        if (
          bee.creep.store.getUsedCapacity() > 0 &&
          this.cell.storage.store.getFreeCapacity() > 0
        )
          bee.transfer(this.cell.storage, findOptimalResource(bee.store));
        else if (transfer) bee.state = beeStates.refill;
        else bee.state = beeStates.chill;

      if (transfer) {
        if (
          !transfer.process(bee) &&
          !transfer.priority &&
          bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0
        ) {
          const ss = (
            bee.pos
              .findInRange(FIND_MY_STRUCTURES, 1)
              .filter(
                (s) =>
                  s.structureType === STRUCTURE_EXTENSION ||
                  s.structureType === STRUCTURE_SPAWN
              ) as (StructureSpawn | StructureExtension)[]
          ).filter((s) => s.store.getFreeCapacity(RESOURCE_ENERGY))[0];
          if (ss) bee.transfer(ss, RESOURCE_ENERGY);
        }
      } else if (bee.creep.store.getUsedCapacity() > 0)
        bee.state = beeStates.fflush;

      if (bee.state === beeStates.chill) bee.goRest(this.cell.pos);
      this.checkFlee(bee, this.hive, undefined, false);
    });
  }
}
