import type { Bee } from "bees/bee";
import { setups } from "bees/creepSetups";
import type { CorridorMiningCell } from "cells/stage2/corridorMining";
import { profile } from "profiler/decorator";
import { beeStates } from "static/enums";

import { Master } from "../_Master";
import { DepositMinerMaster } from "./mineDep";

const MAX_PULLERS_PER_HIVE = 4;

@profile
export class PullerMaster extends Master<CorridorMiningCell> {
  // #region Properties (2)

  private freePullers: Bee[] = [];

  public movePriority = 3 as const;

  // #endregion Properties (2)

  // #region Public Accessors (1)

  public override get targetBeeCount(): number {
    let possibleTargets = this.minersToMove.length;

    this.freePullers = _.filter(this.bees, (b) => b.state === beeStates.chill);

    _.forEach(this.parent.depositsOn, (m) => {
      if (m.miners.waitingForBees && !this.removeFreePuller(m.roadTime))
        this.freePullers.pop();
      if (m.miners.waitingForBees || m.miners.checkBees())
        possibleTargets += Math.max(
          1,
          m.miners.targetBeeCount - m.miners.beesAmount
        );
    });

    return Math.min(possibleTargets, MAX_PULLERS_PER_HIVE);
  }

  // #endregion Public Accessors (1)

  // #region Private Accessors (1)

  private get minersToMove() {
    let minersToMove: Bee[] = [];
    _.forEach(this.parent.depositSites, (m) => {
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

  // #endregion Private Accessors (1)

  // #region Public Methods (3)

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
            bee.fleeRoom(this.hiveName);
            return;
          }
          bee.goRest(this.hive.rest, { offRoad: true, useFindRoute: true });
          break;
        case beeStates.work: {
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
                : depMaster.pos.getOpenPositions()[0] || depMaster.pos;
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
      }
      this.checkFlee(bee, undefined, { movingTarget: true });
    });
  }

  public override update() {
    super.update();

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
    const maxRoadTime =
      _.max(_.map(this.parent.depositsOn, (d) => d.roadTime)) || 0;

    if (this.checkBees(true, CREEP_LIFE_TIME - maxRoadTime))
      this.wish({
        setup: setups.puller,
        priority: 8,
      });
  }

  // #endregion Public Methods (3)
}
