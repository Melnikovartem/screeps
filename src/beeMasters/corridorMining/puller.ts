import { Master } from "../_Master";
import { DepositMinerMaster } from "./miners";
import { PowerMaster } from "./power";

import { beeStates, prefix } from "../../enums";
import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";
import type { DepositMaster } from "./deposit";
import type { Hive } from "../../Hive";
import type { Bee } from "../../bees/bee";


@profile
export class PullerMaster extends Master {
  movePriority = <4>4;
  maxRoadTime: number = 0;
  depositSites: DepositMaster[] = [];
  powerSites: PowerMaster[] = [];
  freePullers: Bee[] = [];

  sitesON: (DepositMaster | PowerMaster)[] = [];

  constructor(hive: Hive) {
    super(hive, prefix.puller + hive.roomName);
  }

  removeFreePuller(roadTime: number) {
    let puller = _.filter(this.freePullers, b => b.ticksToLive >= roadTime + b.pos.getRoomRangeTo(this.hive) * 50)[0];
    if (puller) {
      this.freePullers.splice(this.freePullers.indexOf(puller));
      return true;
    }
    return false;
  }

  update() {
    super.update();

    let workingPowerSites = this.powerSites.filter(p => p.operational);
    this.sitesON = workingPowerSites.filter(p => workingPowerSites.indexOf(p) <= 2 || p.beesAmount);
    if (workingPowerSites.length)
      _.forEach(this.powerSites, p => {
        if (!p.maxSpawns)
          _.forEach(p.bees, b => {
            let inNeed = workingPowerSites.filter(wp => Math.floor(wp.beesAmount / 2) < wp.targetBeeCount / 2 + 1);
            let nextMaster = b.pos.findClosest(inNeed.length ? inNeed : workingPowerSites);
            if (nextMaster) {
              p.removeBee(b);
              nextMaster.newBee(b);
            }
          });
      });


    let workingDeposits = this.depositSites.filter(d => d.operational).slice(0, 2);
    this.sitesON = this.sitesON.concat(workingDeposits);

    _.forEach(this.bees, bee => {
      if (bee.state === beeStates.chill) {
        let newTarget = this.minersToMove[0];
        if (newTarget && (bee.ticksToLive >= (<DepositMinerMaster>newTarget.master).parent.roadTime
          || !this.activeBees.filter(b => b.target === newTarget.ref).length)) {
          bee.target = newTarget.ref;
          bee.state = beeStates.work;
        }
      }
    });

    if (this.hive.resState[RESOURCE_ENERGY] < 50000)
      this.sitesON = this.sitesON.filter(m => m instanceof PowerMaster && m.beesAmount);

    let possibleTargets = this.minersToMove.length;
    this.maxRoadTime = 0;

    this.freePullers = _.filter(this.bees, b => b.state === beeStates.chill);

    _.forEach(this.depositSites, m => {
      if (!m.operational)
        return;
      this.maxRoadTime = Math.max(this.maxRoadTime, m.roadTime);
      if (m.miners.waitingForBees || m.miners.checkBees(false, CREEP_LIFE_TIME - m.roadTime) && m.shouldSpawn)
        possibleTargets += Math.max(1, m.miners.targetBeeCount - m.miners.beesAmount);
      if (m.miners.waitingForBees && !this.removeFreePuller(m.roadTime))
        this.freePullers.pop();
    });

    this.targetBeeCount = Math.min(possibleTargets, 4);

    if (this.checkBees())
      this.wish({
        setup: setups.puller,
        priority: 8,
      });
  }

  checkBees(): boolean {
    return super.checkBees(false, CREEP_LIFE_TIME - this.maxRoadTime) && !!this.maxRoadTime;
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
            if (pos.getRangeTo(bee) > 3 || !pos.equal(depMaster.pos)) {
              bee.pull(beeToPull, pos, { range: 0, obstacles: depMaster.positions.filter(p => !p.pos.equal(pos)), useFindRoute: true });
              pulled.push(beeToPull.ref);
            }
          }
          this.checkFlee(bee, depMaster.pos, { movingTarget: true });
      }
    });
  }
}
