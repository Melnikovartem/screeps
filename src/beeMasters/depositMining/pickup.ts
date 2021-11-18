import { Master } from "../_Master";

import { beeStates, prefix } from "../../enums";
import { setups } from "../../bees/creepsetups";
import { findOptimalResource } from "../../abstract/utils";

import { profile } from "../../profiler/decorator";
import type { DepositMaster } from "./deposit";

@profile
export class DepositPickupMaster extends Master {
  movePriority = <4>4;
  parent: DepositMaster;

  constructor(parent: DepositMaster) {
    super(parent.hive, parent.ref + prefix.pickup);
    this.parent = parent;
  }

  recalculateTargetBee() {
    let body = setups.pickup.getBody(this.hive.room.energyCapacityAvailable).body;
    let carry = body.filter(b => b === CARRY).length * CARRY_CAPACITY;
    this.targetBeeCount = Math.max(1, Math.ceil(this.parent.rate * this.parent.roadTime / carry));
  }

  checkBeesWithRecalc() {
    let check = () => this.checkBees(false, CREEP_LIFE_TIME - this.parent.roadTime * 2);
    if (this.targetBeeCount && !check())
      return false;
    this.recalculateTargetBee();
    return check();
  }

  update() {
    super.update();
    if (this.checkBeesWithRecalc() && this.parent.miners.beesAmount && this.parent.operational)
      this.wish({
        setup: setups.pickup,
        priority: 6,
      });
  }

  run() {
    _.forEach(this.activeBees, bee => {
      if (bee.ticksToLive < this.parent.roadTime + 10 || bee.store.getFreeCapacity() < this.parent.positions * 48 + 50)
        bee.state = beeStates.work;
      switch (bee.state) {
        case beeStates.chill:
          let beeToPickUp = this.parent.miners.activeBees.filter(b => b.store.getUsedCapacity() > 0)[0];
          if (!beeToPickUp) {
            bee.goRest(this.parent.rest);
            break;
          }
          if (bee.pos.isNearTo(beeToPickUp))
            beeToPickUp.creep.transfer(bee.creep, findOptimalResource(beeToPickUp.store));
          else
            bee.goTo(beeToPickUp, { obstacles: this.parent.pos.getOpenPositions(true).map(p => { return { pos: p } }) });
          break;
        case beeStates.work:
          bee.transfer(this.hive.cells.storage!.storage, findOptimalResource(bee.store));
          break;
      }
      this.checkFlee(bee);
    });
  }
}
