import { Master } from "../_Master";
import { DepositMinerMaster } from "./miners";

import { beeStates, prefix } from "../../enums";
import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";
import type { DepositMaster } from "./deposit";
import type { PowerMaster } from "./power";
import type { Hive } from "../../Hive";
import type { Bee } from "../../bees/bee";


@profile
export class DepositPullerMaster extends Master {
  movePriority = <4>4;
  depositSites: DepositMaster[] = [];
  powerSites: PowerMaster[] = [];
  freePullers: Bee[] = [];

  constructor(hive: Hive) {
    super(hive, prefix.puller + hive.roomName);
  }

  removeFreePuller(roadTime: number) {
    let puller = _.filter(this.freePullers, b => b.ticksToLive > roadTime + 150)[0];
    if (puller) {
      this.freePullers.splice(this.freePullers.indexOf(puller));
      return true;
    }
    return false;
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

    this.freePullers = _.filter(this.bees, b => b.state === beeStates.chill && b.pos.getRoomRangeTo(this.hive) < 3);

    _.forEach(this.depositSites, m => {
      maxRoadTime = Math.max(maxRoadTime, m.roadTime);
      if (m.miners.waitingForBees || m.miners.checkBees(false, CREEP_LIFE_TIME - m.roadTime) && m.operational)
        possibleTargets += Math.max(1, m.miners.targetBeeCount - m.beesAmount);
      if (m.miners.waitingForBees && !this.removeFreePuller(m.roadTime))
        this.freePullers.pop();
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
    _.forEach(this.depositSites, m => {
      let targets = _.filter(m.miners.bees, b => b.state !== beeStates.work
        && !_.filter(this.bees, b1 => b1.target === b.ref && b1.state === beeStates.work && b1.ticksToLive > m.roadTime - 10).length);
      minersToMove = minersToMove.concat(targets);
    });
    return minersToMove;
  }

  run() {
    let pulled: string[] = [];
    _.forEach(this.activeBees, bee => {
      switch (bee.state) {
        case beeStates.chill:
          bee.goRest(this.hive.rest, { offRoad: true });
          break;
        case beeStates.work:
          let beeToPull = <Bee>(bee.target && Apiary.bees[bee.target]);
          let depMaster = beeToPull && (beeToPull.master instanceof DepositMinerMaster) && beeToPull.master.parent;
          if (!depMaster || beeToPull.pos.isNearTo(depMaster)) {
            bee.target = undefined;
            bee.state = beeStates.chill;
            bee.goRest(this.hive.rest, { offRoad: true });
            break;
          }
          if (pulled.includes(beeToPull.ref)) {
            if (bee.pos.getRangeTo(beeToPull) > 3)
              bee.goRest(beeToPull.pos, { offRoad: true, movingTarget: true });
          } else if (beeToPull.creep.spawning)
            bee.goRest(beeToPull.pos, { offRoad: true });
          else {
            let pos = depMaster.pos;
            if (bee.pos.roomName === pos.roomName)
              pos = bee.pos.isNearTo(depMaster) ? bee.pos : (depMaster.pos.getOpenPositions(false)[0] || depMaster.pos);
            bee.pull(beeToPull, pos, { range: 0, obstacles: depMaster.positions.filter(p => !p.pos.equal(pos)), offRoad: true });
            pulled.push(beeToPull.ref);
          }
          this.checkFlee(bee, depMaster.pos, { movingTarget: true });
      }
    });
  }
}
