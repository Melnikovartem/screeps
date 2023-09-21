import type { DepositMaster } from "beeMasters/corridorMining/deposit";
import type { PowerMiningMaster } from "beeMasters/corridorMining/power";
import { PullerMaster } from "beeMasters/corridorMining/puller";
import type { Hive } from "hive/hive";
import { profile } from "profiler/decorator";
import { prefix } from "static/enums";

import { Cell } from "../_Cell";

const MINING_POWER_STOCKPILE = 30_000;

export const STOCKPILE_CORRIDOR_COMMODITIES = {
  /** start using not locally but over the apiary */
  compress: { global: 16_000 },
  /** stop mining but this time only in the hive with big stockpile  */
  stopmining: { local: 32_000, global: 100_000 },
};

@profile
export class CorridorMiningCell extends Cell {
  // #region Properties (5)

  public depositSites: DepositMaster[] = [];
  public depositsOn: DepositMaster[] = [];
  public override master: PullerMaster;
  public powerOn: PowerMiningMaster[] = [];
  public powerSites: PowerMiningMaster[] = [];

  // #endregion Properties (5)

  // #region Constructors (1)

  public constructor(hive: Hive) {
    super(hive, prefix.corridorMiningCell);
    this.master = new PullerMaster(this);
  }

  // #endregion Constructors (1)

  // #region Public Methods (2)

  public run() {}

  public override update() {
    // decide wich powerSites to mine
    const workingPowerSites = this.powerSites.filter((p) => p.canMineInTime());
    let inProgress = workingPowerSites.filter(
      (p) => p.beesAmount || p.waitingForBees
    );
    if (
      !inProgress.length &&
      this.hive.mode.powerMining &&
      workingPowerSites.length &&
      this.hive.getUsedCapacity(RESOURCE_POWER) <= MINING_POWER_STOCKPILE
    )
      inProgress = [
        workingPowerSites.reduce((prev, curr) =>
          prev.roadTime > curr.roadTime ? curr : prev
        ),
      ];
    this.powerOn = inProgress;

    // reposess power bees to other masters
    if (workingPowerSites.length)
      _.forEach(this.powerSites, (p) => {
        if (p.keepMining) return;

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

    // decide wich deposits to mine
    if (this.hive.mode.depositMining) {
      let workingDeposits = this.depositSites.filter(
        (d) =>
          d.keepMining &&
          d.resource &&
          this.hive.getResState(d.resource) <
            STOCKPILE_CORRIDOR_COMMODITIES.stopmining.local &&
          Apiary.network.getResState(d.resource) <
            STOCKPILE_CORRIDOR_COMMODITIES.stopmining.global
      );

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
      this.depositsOn = workingDeposits;
    }

    // do not mine if problems
    if (this.hive.getResState(RESOURCE_ENERGY) < 0 || this.hive.isBattle) {
      this.depositsOn = [];
      this.powerOn = this.powerOn.filter((m) => m.beesAmount);
    }
  }

  // #endregion Public Methods (2)
}
