import { Master } from "../_Master";
import { DepositMinerMaster } from "./miners";

import { beeStates, prefix } from "../../enums";
import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";
import type { DepositMaster } from "./deposit";
import type { Hive } from "../../Hive";
import type { Bee } from "../../bees/bee";


@profile
export class DepositPullerMaster extends Master {
  movePriority = <4>4;
  miningSites: DepositMaster[] = [];

  constructor(hive: Hive) {
    super(hive, prefix.puller + hive.roomName);
  }

  update() {
    super.update();

    _.forEach(this.bees, bee => {
      if (bee.state === beeStates.chill) {
        let newTarget = this.minersToMove[0];
        if (newTarget) {
          bee.target = newTarget.ref;
          bee.state = beeStates.work;
        }
      }
    });

    let possibleTargets = this.minersToMove.length;
    let maxRoadTime = 0;
    _.forEach(this.miningSites, m => {
      maxRoadTime = Math.max(maxRoadTime, m.roadTime);
      if (m.miners.checkBees(false, CREEP_LIFE_TIME - m.roadTime) && m.operational)
        possibleTargets++;
    });

    this.targetBeeCount = 1;
    if (possibleTargets > 1)
      ++this.targetBeeCount;

    if (possibleTargets &&
      this.checkBees(false, CREEP_LIFE_TIME - maxRoadTime)
      && this.hive.resState[RESOURCE_ENERGY] > 0 && maxRoadTime)
      this.wish({
        setup: setups.puller,
        priority: 7,
      });
  }

  get minersToMove() {
    let minersToMove: Bee[] = [];
    _.forEach(this.miningSites, m => {
      let targets = _.filter(m.miners.bees, b => b.state !== beeStates.work
        && !_.filter(this.bees, b1 => b1.target === b.ref && b1.state === beeStates.work && b1.ticksToLive > m.roadTime - 10).length);
      minersToMove = minersToMove.concat(targets);
    });
    return minersToMove;
  }

  run() {
    _.forEach(this.activeBees, bee => {
      switch (bee.state) {
        case beeStates.chill:
          bee.goRest(this.hive.rest, { offRoad: true });
          break;
        case beeStates.work:
          let beeToPull = <Bee>(bee.target && Apiary.bees[bee.target]);
          let depMaster = beeToPull && (beeToPull.master instanceof DepositMinerMaster) && beeToPull.master.parent
          if (!depMaster || beeToPull.pos.isNearTo(depMaster)) {
            bee.target = undefined;
            bee.state = beeStates.chill;
            bee.goRest(this.hive.rest, { offRoad: true });
            break;
          }
          if (beeToPull.creep.spawning)
            bee.goRest(beeToPull.pos, { offRoad: true });
          else {
            let pos = depMaster.pos;
            if (bee.pos.roomName === pos.roomName)
              pos = depMaster.pos.getOpenPositions(false)[0] || depMaster.pos;
            bee.pull(beeToPull, pos, { range: 0, obstacles: depMaster.positions, offRoad: true });
          }
          this.checkFlee(bee, depMaster.pos);
      }
    });
  }
}
