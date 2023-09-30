import type { Hive } from "hive/hive";

import type { Visuals } from "./visuals";
import { SPACING } from "./visuals-constants";

export function mastersStateHive(this: Visuals, hive: Hive) {
  const ans: string[][] = [["", "⏳", "🐝"]];
  let cell;
  cell = hive.cells.spawn;
  if (cell) {
    if (hive.bassboost) ans.push(["spawn", "→" + hive.bassboost.roomName, ":"]);
    else
      ans.push([
        "spawn",
        !hive.cells.spawn.spawnQue.length
          ? ""
          : ` ${hive.cells.spawn.spawnQue.length}`,
        this.getBeesAmount(cell.master),
      ]);
  }
  cell = hive.cells.storage;
  if (cell)
    ans.push([
      "storage",
      !Object.keys(cell.requests).length
        ? ""
        : ` ${_.filter(cell.requests, (r) => r.priority).length}/${
            Object.keys(cell.requests).length
          }`,
      this.getBeesAmount(cell.master),
    ]);

  cell = hive.cells.dev;
  if (cell) ans.push(["develop", "", this.getBeesAmount(cell.master)]);
  if (hive.phase > 0) {
    cell = hive.cells.excavation;
    ans.push([
      "excav",
      !cell.quitefullCells.length
        ? ""
        : ` ${cell.quitefullCells.length}/${
            _.filter(cell.resourceCells, (c) => c.operational && !c.link).length
          }`,
      this.getBeesAmount(cell.master),
    ]);
  }

  const stats = { waitingForBees: 0, beesAmount: 0, targetBeeCount: 0 };
  let operational = 0;
  let all = 0;
  _.forEach(hive.cells.excavation.resourceCells, (rcell) => {
    ++all;
    operational += rcell.operational ? 1 : 0;
    if (
      rcell.master &&
      (rcell.operational ||
        rcell.master.beesAmount ||
        rcell.master.waitingForBees)
    ) {
      stats.beesAmount += rcell.master.beesAmount;
      stats.waitingForBees += rcell.master.waitingForBees;
      stats.targetBeeCount += rcell.master.targetBeeCount;
    }
  });
  ans.push([
    "resource",
    operational === all ? "" : ` ${operational}/${all}`,
    this.getBeesAmount(stats),
  ]);

  /* const annexOrders = _.filter(
      Apiary.orders,
      (o) =>
        o.hive === hive &&
        o.flag.color === COLOR_PURPLE &&
        o.flag.secondaryColor === COLOR_PURPLE
    );
    if (annexOrders.length) {
      stats = { waitingForBees: 0, beesAmount: 0, targetBeeCount: 0 };
      const statsPuppet = {
        waitingForBees: 0,
        beesAmount: 0,
        targetBeeCount: 0,
      };
      operational = 0;
      all = 0;
      _.forEach(annexOrders, (o) => {
        ++all;
        operational += o.acted ? 1 : 0;
        if (o.master)
          if (o.master instanceof AnnexMaster) {
            stats.beesAmount += o.master.beesAmount;
            stats.waitingForBees += o.master.waitingForBees;
            stats.targetBeeCount += o.master.targetBeeCount;
          } else {
            statsPuppet.beesAmount += o.master.beesAmount;
            statsPuppet.waitingForBees += o.master.waitingForBees;
            statsPuppet.targetBeeCount += o.master.targetBeeCount;
          }
      });
      ans.push([
        "annex",
        operational === all ? "" : ` ${operational}/${all}`,
        this.getBeesAmount(stats),
      ]);
      if (statsPuppet.targetBeeCount > 0)
        ans.push(["pups", "", this.getBeesAmount(statsPuppet)]);
    } */

  let sumCost: string | number = hive.cells.build.sumCost;
  if (sumCost || hive.cells.build.master?.beesAmount) {
    if (sumCost > 1_000_000)
      sumCost = Math.round((sumCost / 1_000_000) * 10) / 10 + "M";
    else if (sumCost > 5_000) sumCost = Math.round(sumCost / 1_000) + "K";
    else if (sumCost > 0)
      sumCost = Math.round((sumCost / 1_000) * 10) / 10 + "K";

    ans.push([
      "build",
      sumCost === 0
        ? ""
        : ` ${sumCost}/${hive.cells.build.structuresConst.length}`,
      this.getBeesAmount(hive.cells.build.master),
    ]);
  }

  ans.push([
    "upgrade",
    ` ${
      !hive.controller.progressTotal
        ? ""
        : Math.floor(
            (hive.controller.progress / hive.controller.progressTotal) * 100
          ) + "%"
    }`,
    this.getBeesAmount(hive.cells.upgrade && hive.cells.upgrade.master),
  ]);

  if (
    hive.isBattle ||
    hive.cells.defense.master.beesAmount ||
    hive.cells.defense.master.waitingForBees
  )
    ans.push([
      "defense",
      ` ${Apiary.intel.getInfo(hive.roomName, 20).dangerlvlmax}`,
      this.getBeesAmount(hive.cells.defense.master),
    ]);

  this.table(ans);
}
export function resStateHive(this: Visuals, hive: Hive) {
  const negative: string[][] = [["💱", "📉"]];

  for (const res in hive.resState) {
    const amount = hive.resState[res as ResourceConstant];
    if (amount && amount < 0) {
      let str = " " + -amount;
      if (amount < -1000) str = " " + -Math.round(amount / 100) / 10 + "K";
      negative.push([res, str]);
    }
  }
  const [x, y] = [this.anchor.x, this.anchor.y];
  if (negative.length > 2) {
    this.objectNew({ x: x + SPACING, y: 1 });
    this.table(negative, "deficiency");
  }
  this.objectNew({ x: 1, y: Math.max(y, this.anchor.y) + SPACING });
}

export function aidHive(this: Visuals, hive: Hive) {
  const aid = Apiary.network.aid[hive.roomName];
  if (aid) this.label(`💸 ${aid.to} -> ${aid.res} ${aid.amount}`);
}

export function statsFactory(this: Visuals, hive: Hive) {
  if (!hive.cells.factory) return;
  const fac = hive.cells.factory;
  if (!fac.commodityTarget) return;

  const process = (ss: string) => {
    const splt = ss.split("_");
    if (splt.length > 1) splt[0] = splt[0].slice(0, 6);
    return splt.join(" ").slice(0, 15);
  };
  const prod = fac.prod ? process(fac.prod.res) + " " + fac.prod.plan : "??";
  const target =
    process(fac.commodityTarget.res) + " " + fac.commodityTarget.amount;
  this.label(`🏭 ${prod} -> ${target}`);
}

export function statsLab(this: Visuals, hive: Hive) {
  if (!hive.cells.lab) return;
  const lab = hive.cells.lab;

  if (lab.synthesizeTarget)
    this.label(
      `🧪 ${lab.prod ? lab.prod.res + " " + lab.prod.plan : "??"} -> ${
        lab.synthesizeTarget.res
      } ${lab.synthesizeTarget.amount}`
    );

  if (Object.keys(hive.cells.lab.boostRequests).length) {
    const ans = [["🐝", "", "🧬", " 🧪", "🥼"]];
    for (const refBee in lab.boostRequests) {
      // let splitName = refBee.split(" ");
      // splitName.pop();
      const name = refBee; // .map(s => s.slice(0, 5) + (s.length > 5 ? "." : ""))
      for (let i = 0; i < lab.boostRequests[refBee].info.length; ++i) {
        const r = lab.boostRequests[refBee].info[i];
        const l = lab.boostLabs[r.res];
        ans.push([
          !i ? name : "-",
          r.type,
          r.res,
          "  " + r.amount,
          l ? l.slice(l.length - 4) : "not found",
        ]);
      }
    }

    this.table(ans);
  }
}
