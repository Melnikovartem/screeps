import type { Bee } from "bees/bee";
import { setups } from "bees/creepSetups";
import type { Hive } from "hive/hive";
import { profile } from "profiler/decorator";
import { beeStates, hiveStates, prefix } from "static/enums";

import { Master } from "../_Master";
import type { DepositMaster } from "./deposit";
import { DepositMinerMaster } from "./miners";
import { PowerMaster } from "./power";

@profile
export class PullerMaster extends Master {
  public movePriority = 4 as const;
  private maxRoadTime: number = 0;
  public depositSites: DepositMaster[] = [];
  public powerSites: PowerMaster[] = [];
  private freePullers: Bee[] = [];

  public sitesON: (DepositMaster | PowerMaster)[] = [];

  public constructor(hive: Hive) {
    super(hive, prefix.puller + hive.roomName);
  }

  public removeFreePuller(roadTime: number) {
    const puller = _.filter(
      this.freePullers,
      (b) => b.ticksToLive >= roadTime + b.pos.getRoomRangeTo(this.hive) * 50
    )[0];
    if (puller) {
      this.freePullers.splice(this.freePullers.indexOf(puller));
      return true;
    }
    return false;
  }

  public update() {
    super.update();

    const workingPowerSites = this.powerSites.filter((p) => p.operational);
    let inProgress = workingPowerSites.filter(
      (p) => p.beesAmount || p.waitingForBees
    );
    if (
      !inProgress.length &&
      this.hive.mode.powerMining &&
      workingPowerSites.length &&
      this.hive.cells.storage &&
      this.hive.cells.storage.getUsedCapacity(RESOURCE_POWER) <= 30000
    )
      inProgress = [
        workingPowerSites.reduce((prev, curr) =>
          prev.roadTime > curr.roadTime ? curr : prev
        ),
      ];
    this.sitesON = inProgress;

    if (workingPowerSites.length)
      _.forEach(this.powerSites, (p) => {
        if (!p.maxSpawns)
          _.forEach(p.bees, (b) => {
            const inNeed = workingPowerSites.filter(
              (wp) => Math.floor(wp.beesAmount / 2) < wp.targetBeeCount / 2 + 1
            );
            const nextMaster = b.pos.findClosest(
              inNeed.length ? inNeed : workingPowerSites
            );
            if (nextMaster) {
              p.removeBee(b);
              nextMaster.newBee(b);
            }
          });
      });

    let workingDeposits: DepositMaster[] = [];
    if (this.hive.mode.depositMining) {
      workingDeposits = this.depositSites.filter((d) => d.operational);
      if (workingDeposits.length > 1) {
        const depositsWithBees = workingDeposits.filter(
          (d) => d.miners.beesAmount || d.pickup.beesAmount
        );
        if (depositsWithBees.length) workingDeposits = depositsWithBees;
        else
          workingDeposits = [
            workingDeposits.reduce((prev, curr) => {
              let ans = curr.roadTime - prev.roadTime;
              if (Math.abs(ans) < 65)
                ans = curr.lastCooldown - prev.lastCooldown;
              return ans < 0 ? curr : prev;
            }),
          ];
      }
      this.sitesON = this.sitesON.concat(workingDeposits);
    }

    _.forEach(this.bees, (bee) => {
      if (bee.state === beeStates.chill) {
        const newTarget = this.minersToMove[0];
        if (
          newTarget &&
          (bee.ticksToLive >=
            (newTarget.master as DepositMinerMaster).parent.roadTime ||
            !this.activeBees.filter((b) => b.target === newTarget.ref).length)
        ) {
          bee.target = newTarget.ref;
          bee.state = beeStates.work;
        }
      }
    });

    if (
      this.hive.resState[RESOURCE_ENERGY] < 0 ||
      this.hive.state >= hiveStates.battle
    )
      this.sitesON = this.sitesON.filter(
        (m) => m instanceof PowerMaster && m.beesAmount
      );

    let possibleTargets = this.minersToMove.length;
    this.maxRoadTime = 0;

    this.freePullers = _.filter(this.bees, (b) => b.state === beeStates.chill);

    _.forEach(workingDeposits, (m) => {
      this.maxRoadTime = Math.max(this.maxRoadTime, m.roadTime);
      if (m.miners.waitingForBees || m.miners.checkBees())
        possibleTargets += Math.max(
          1,
          m.miners.targetBeeCount - m.miners.beesAmount
        );
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

  public checkBees = (): boolean => {
    return (
      super.checkBees(true, CREEP_LIFE_TIME - this.maxRoadTime) &&
      !!this.maxRoadTime
    );
  };

  private get minersToMove() {
    let minersToMove: Bee[] = [];
    _.forEach(this.depositSites, (m) => {
      const targets = _.filter(
        m.miners.bees,
        (b) =>
          b.state !== beeStates.work &&
          !_.filter(
            this.bees,
            (b1) =>
              b1.target === b.ref &&
              b1.state === beeStates.work &&
              b1.ticksToLive > m.roadTime - 10
          ).length
      );
      minersToMove = minersToMove.concat(targets);
    });
    return minersToMove;
  }

  public run() {
    const pulled: string[] = [];
    _.forEach(this.activeBees, (bee) => {
      switch (bee.state) {
        case beeStates.chill:
          if (
            this.hive.cells.defense.timeToLand < 50 &&
            bee.ticksToLive > 50 &&
            bee.pos.getRoomRangeTo(this.hive) <= 1
          ) {
            bee.fleeRoom(this.roomName);
            return;
          }
          bee.goRest(this.hive.rest, { offRoad: true, useFindRoute: true });
          break;
        case beeStates.work:
          const beeToPull = (bee.target && Apiary.bees[bee.target]) as Bee;
          const depMaster =
            beeToPull &&
            beeToPull.master instanceof DepositMinerMaster &&
            beeToPull.master.parent;
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
              pos = bee.pos.isNearTo(depMaster)
                ? bee.pos
                : depMaster.pos.getOpenPositions(false)[0] || depMaster.pos;
            const range = pos.equal(depMaster.pos) ? 1 : 0;
            if (pos.getRangeTo(bee) > 3 || !range) {
              bee.pull(beeToPull, pos, {
                range,
                obstacles: depMaster.positions.filter((p) => !p.pos.equal(pos)),
                useFindRoute: true,
              });
              pulled.push(beeToPull.ref);
            }
          }
      }
      this.checkFlee(bee, undefined, { movingTarget: true });
    });
  }
}
