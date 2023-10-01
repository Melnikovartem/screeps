import type { Hive } from "hive/hive";
import { SWARM_MASTER } from "orders/swarm-nums";

import type { Visuals } from "./visuals";

interface PseudoCell {
  master?: {
    waitingForBees: number;
    beesAmount: number;
    targetBeeCount: number;
  };
  refCache: string;
}

const statsEmpty = { waitingForBees: 0, beesAmount: 0, targetBeeCount: 0 };

export function mastersStateHive(visuals: Visuals, hive: Hive) {
  const ans: string[][] = [["", "⏳", "🐝"]];
  const addCell = (cell: PseudoCell) => {
    if (!cell.master) return;
    const beesAmount = visuals.getBeesAmount(cell.master);
    if (!beesAmount.length) return;
    ans.push([cell.refCache].concat(beesAmount));
  };

  _.forEach(hive.cells, (c) => {
    addCell(c as PseudoCell);
  });

  const statsRes = { ...statsEmpty };
  _.forEach(hive.cells.excavation.resourceCells, (rcell) => {
    if (
      rcell.operational ||
      rcell.master.beesAmount ||
      rcell.master.waitingForBees
    ) {
      statsRes.beesAmount += rcell.master.beesAmount;
      statsRes.waitingForBees += rcell.master.waitingForBees;
      statsRes.targetBeeCount += rcell.master.targetBeeCount;
    }
  });
  addCell({ refCache: "resource", master: statsRes });

  const statsAnnex = { ...statsEmpty };
  const statsSk = { ...statsEmpty };
  _.forEach(hive.cells.annex.swarms, (s) => {
    let stats;
    switch (s.type) {
      case SWARM_MASTER.sk:
        stats = statsSk;
        break;
      case SWARM_MASTER.annex:
        stats = statsAnnex;
        break;
      default:
        return;
    }
    stats.beesAmount += s.master.beesAmount;
    stats.waitingForBees += s.master.waitingForBees;
    stats.targetBeeCount += 1;
  });
  addCell({ refCache: "annex", master: statsAnnex });
  addCell({ refCache: "sk", master: statsSk });

  /* 
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
    visuals.getBeesAmount(stats),
  ]); 
  */

  return visuals.table(ans, "hive bees");
}

export function resStateHive(visuals: Visuals, hive: Hive) {
  const negative: string[][] = [];

  for (const res in hive.resState) {
    const amount = hive.getResState(res as ResourceConstant);
    if (amount < 0) negative.push([res, visuals.formatNumber(-amount)]);
  }
  if (!negative.length) return;
  return visuals.table([["💱", "📉"]].concat(negative), "deficiency");
}

const MIN_HIVE_BAR_SIZE = 10;

export function aidHive(visuals: Visuals, hive: Hive) {
  const aid = Apiary.network.aid[hive.roomName];
  if (aid)
    visuals.label(`💸 ${aid.to} → ${aid.res} ${aid.amount}`, MIN_HIVE_BAR_SIZE);
}

export function statsNukes(visuals: Visuals, hive: Hive) {
  _.forEach(hive.cells.defense.nukes, (nuke) => {
    const percent = 1 - nuke.timeToLand / NUKE_LAND_TIME;
    visuals.progressbar(
      `☢ ${nuke.launchRoomName} ${nuke.timeToLand} : ${
        Math.round(percent * 1000) / 10
      }%`,
      percent,
      MIN_HIVE_BAR_SIZE
    );
  });
}

export function statsFactory(visuals: Visuals, hive: Hive) {
  if (!hive.cells.factory) return;
  const fac = hive.cells.factory;
  const symbol = "🏭";
  if (!fac.commodityTarget) {
    const porgress = fac.progressToNewTarget;
    if (porgress === -1) return;
    return visuals.progressbar(
      `${symbol} 🔍 looking for taret...`,
      porgress,
      MIN_HIVE_BAR_SIZE
    );
  }
  const process = (ss: string) => {
    const splt = ss.split("_");
    if (splt.length > 1) splt[0] = splt[0].slice(0, 6);
    return splt.join(" ").slice(0, 15);
  };

  const prodInfo = `${symbol} ${process(fac.commodityTarget.res)} ${
    fac.commodityTarget.amount
  } → `;
  if (!fac.prod)
    return visuals.progressbar(
      `${prodInfo}🔍 prod`,
      fac.progressToProd,
      MIN_HIVE_BAR_SIZE
    );
  return visuals.label(
    `${prodInfo}${process(fac.prod.res)} ${fac.prod.plan}`,
    MIN_HIVE_BAR_SIZE
  );
}

export function statsLab(visuals: Visuals, hive: Hive) {
  if (!hive.cells.lab) return visuals.anchor;
  const lab = hive.cells.lab;

  const symbol = "🧪";
  if (!lab.synthesizeTarget) {
    const porgress = lab.progressToNewTarget;
    if (porgress === -1) return visuals.anchor;
    return visuals.progressbar(
      `${symbol} 🔍 looking for taret...`,
      porgress,
      MIN_HIVE_BAR_SIZE
    );
  }

  const prodInfo = `${symbol} ${lab.synthesizeTarget.res} ${lab.synthesizeTarget.amount} → `;
  if (!lab.prod) {
    if (!lab.prodWithoutLabs)
      return visuals.progressbar(`${prodInfo}🔍 prod`, lab.progressToProd);
    const lookingForLabs = `${prodInfo}${lab.prodWithoutLabs.res} ${lab.prodWithoutLabs.plan} → `;
    return visuals.progressbar(
      `${prodInfo}${lookingForLabs}🔍 labs`,
      lab.progressToProd,
      MIN_HIVE_BAR_SIZE
    );
  }
  return visuals.label(
    `${prodInfo}${lab.prod.res} ${lab.prod.plan}`,
    MIN_HIVE_BAR_SIZE
  );
}

export function statsBoosts(visuals: Visuals, hive: Hive) {
  if (!hive.cells.lab) return visuals.anchor;
  const lab = hive.cells.lab;
  if (!Object.keys(hive.cells.lab.boostRequests).length) return visuals.anchor;
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
  return visuals.table(ans);
}

export function statsUpgrade(visuals: Visuals, hive: Hive) {
  if (!hive.controller.progressTotal) return;
  const progress = hive.controller.progress / hive.controller.progressTotal;
  return visuals.progressbar(
    `controller upgrade ⬆️ ${Math.floor(progress * 100)}%`,
    progress,
    MIN_HIVE_BAR_SIZE
  );
}
