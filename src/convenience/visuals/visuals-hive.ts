import type { Hive } from "hive/hive";

import type { Visuals } from "./visuals";

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

  return this.table(ans);
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

  if (negative.length <= 2) return;
  return this.table(negative, "deficiency");
}

export function aidHive(this: Visuals, hive: Hive) {
  const aid = Apiary.network.aid[hive.roomName];
  if (aid) this.label(`💸 ${aid.to} -> ${aid.res} ${aid.amount}`);
}

export function statsNukes(this: Visuals, hive: Hive) {
  const size = 10;
  _.forEach(hive.cells.defense.nukes, (nuke) => {
    const percent = 1 - nuke.timeToLand / NUKE_LAND_TIME;
    this.progressbar(
      `☢ ${nuke.launchRoomName} ${nuke.timeToLand} : ${
        Math.round(percent * 1000) / 10
      }%`,
      percent,
      size
    );
  });
}

export function statsFactory(this: Visuals, hive: Hive) {
  if (!hive.cells.factory) return;
  const fac = hive.cells.factory;
  const symbol = "🏭";
  if (!fac.commodityTarget) {
    const porgress = fac.progressToNewTarget;
    if (porgress === -1) return;
    return this.progressbar(`${symbol} 🔍 looking for taret...`, porgress);
  }
  const process = (ss: string) => {
    const splt = ss.split("_");
    if (splt.length > 1) splt[0] = splt[0].slice(0, 6);
    return splt.join(" ").slice(0, 15);
  };

  const prodInfo = `${symbol} ${process(fac.commodityTarget.res)} ${
    fac.commodityTarget.amount
  } -> `;
  if (!fac.prod)
    return this.progressbar(`${prodInfo}🔍 prod`, fac.progressToProd);
  return this.label(`${prodInfo}${process(fac.prod.res)} ${fac.prod.plan}`);
}

export function statsLab(this: Visuals, hive: Hive) {
  if (!hive.cells.lab) return;
  const lab = hive.cells.lab;

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

  const symbol = "🧪";
  if (!lab.synthesizeTarget) {
    const porgress = lab.progressToNewTarget;
    if (porgress === -1) return;
    return this.progressbar(`${symbol} 🔍 looking for taret...`, porgress);
  }

  const prodInfo = `${symbol} ${lab.synthesizeTarget.res} ${lab.synthesizeTarget.amount} -> `;
  if (!lab.prod) {
    if (!lab.prodWithoutLabs)
      return this.progressbar(`${prodInfo}🔍 prod`, lab.progressToProd);
    const lookingForLabs = `${prodInfo}${lab.prodWithoutLabs.res} ${lab.prodWithoutLabs.plan} -> `;
    return this.progressbar(
      `${prodInfo}${lookingForLabs}🔍 labs`,
      lab.progressToProd
    );
  }
  return this.label(`${prodInfo}${lab.prod.res} ${lab.prod.plan}`);
}
