import "./visluals-planning";

import { PLANNER_STAMP_STOP } from "antBrain/hivePlanner/planner-utils";
import type { Hive } from "hive/hive";
import { profile } from "profiler/decorator";
import { hiveStates, prefix } from "static/enums";
import { makeId } from "static/utils";

import { SPACING, TEXT_HEIGHT, TEXT_SIZE } from "./visuals-constants";
import { statsNetwork } from "./visuals-hive";

interface VisInfo {
  // #region Properties (5)

  keepInMemory: number;
  ref: string;
  vis: RoomVisual;
  x: number;
  y: number;

  // #endregion Properties (5)
}

interface VisCache {
  // #region Properties (2)

  data: string[];
  keepUntil: number;

  // #endregion Properties (2)
}

const GLOBAL_VISUALS_REF = {
  main: "global",
  heavy: "heavy",
};

@profile
export class Visuals {
  // #region Properties (3)

  private statsNetwork = statsNetwork;

  /** current point for adding visuals */
  public anchor: VisInfo = {
    x: 1,
    y: 1,
    vis: new RoomVisual(makeId(8)),
    ref: "",
    keepInMemory: 1,
  };
  /** already added visuals */
  public caching: {
    [ref: string]: VisCache | undefined;
  } = {};

  // #endregion Properties (3)

  // #region Public Methods (10)

  public objectBusy(ref: string) {
    const ex = this.caching[ref];
    return ex && ex.keepUntil >= Apiary.intTime;
  }

  public objectBusyNexTick(ref: string) {
    const ex = this.caching[ref];
    return ex && ex.keepUntil >= Apiary.intTime + 1;
  }

  /**
   * @param pos {x: x, y: y} pos of new anchor. Any value can be ommited
   * @param roomName new roomName. by default anchor is kept within a tick
   * @param keepInMemory how long to keep in memory
   * @returns new anchor to stack visuals on
   */
  public objectNew(
    pos?: { x?: number; y?: number },
    ref?: string,
    keepInMemory = 0
  ) {
    this.objectExport();
    if (!pos) pos = {};

    if (ref === undefined) this.objectMoveAnchor(pos, false);
    else this.emptyAnchor(pos, ref, keepInMemory);

    return this.anchor;
  }

  public objectsWipe(ref: string) {
    this.caching[ref] = undefined;
    if (this.anchor.ref === ref) this.emptyAnchor({}, ref, -1);
  }

  public objectMoveAnchor(
    pos: { x?: number; y?: number },
    addYSpacing: boolean
  ) {
    if (pos.x === undefined) pos.x = this.anchor.x;
    if (pos.y === undefined) pos.y = this.anchor.y + SPACING;
    else if (addYSpacing) pos.y = pos.y + SPACING;

    this.anchor.x = pos.x;
    this.anchor.y = pos.y;
  }

  public run() {
    if (Memory.settings.framerate < 0) return;

    if (Apiary.intTime % Memory.settings.framerate === 0) {
      if (Apiary.useBucket) {
        // heavy calcs
        for (const name in Apiary.hives) this.createHive(name);

        this.objectNew({ x: 30, y: 1 }, GLOBAL_VISUALS_REF.heavy);
        this.battleInfo();
        this.miningInfo();
      }

      // normal stuff

      this.objectNew({ x: 49, y: 1 }, GLOBAL_VISUALS_REF.main);
      this.global();
    }
    this.visualizePlanner();

    // export last uncommited objects
    this.objectExport();
    this._render();
  }

  public spawnInfo(hive: Hive) {
    const usedY: number[] = [];
    _.forEach(hive.cells.spawn.spawns, (s) => {
      if (s.spawning) {
        let x = s.pos.x + 0.8;
        let y = s.pos.y + 0.25;
        if (usedY.indexOf(Math.round(y)) !== -1) {
          y = s.pos.y + 1.7;
          x = s.pos.x - 0.55;
          if (usedY.indexOf(Math.round(y)) !== -1) y = s.pos.y - 1.7;
        }
        usedY.push(Math.round(y));
        this.anchor.vis.text(
          `⚒️ ${s.spawning.name.slice(
            0,
            s.spawning.name.length - 5
          )} ${Math.round(
            (1 - s.spawning.remainingTime / s.spawning.needTime) * 100
          )}%`,
          x,
          y,
          this.textStyle({ stroke: "#2E2E2E", strokeWidth: 0.1, opacity: 0.75 })
        );
      }
    });
  }

  public statsFactory(hive: Hive) {
    if (!hive.cells.factory) return;
    const fac = hive.cells.factory;
    if (fac.commodityTarget) {
      const process = (ss: string) => {
        const splt = ss.split("_");
        if (splt.length > 1) splt[0] = splt[0].slice(0, 6);
        return splt.join(" ").slice(0, 15);
      };
      const prod = fac.prod
        ? process(fac.prod.res) + " " + fac.prod.plan
        : "??";
      const target =
        process(fac.commodityTarget.res) + " " + fac.commodityTarget.amount;
      this.label(`⚒️ ${prod} -> ${target}`, this.anchor);
    }
  }

  public statsHive(hive: Hive) {
    let hiveState = " ";
    switch (hive.state) {
      case hiveStates.economy:
        hiveState += "💹";
        break;
      case hiveStates.lowenergy:
        hiveState += "📉";
        break;
      case hiveStates.nospawn:
        hiveState += "🚨";
        break;
      case hiveStates.nukealert:
        hiveState += "☢️";
        break;
      case hiveStates.battle:
        hiveState += "⚔️";
        break;
      default:
        hiveState += "❔";
        break;
    }
    const ans: string[][] = [
      ["hive " + hive.roomName + hiveState],
      ["", "❓", "🐝"],
    ];
    let cell;
    cell = hive.cells.spawn;
    if (cell) {
      if (hive.bassboost)
        ans.push(["spawn", "→" + hive.bassboost.roomName, ":"]);
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
              _.filter(cell.resourceCells, (c) => c.operational && !c.link)
                .length
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
      hive.state >= hiveStates.battle ||
      hive.cells.defense.master.beesAmount ||
      hive.cells.defense.master.waitingForBees
    )
      ans.push([
        "defense",
        ` ${Apiary.intel.getInfo(hive.roomName, 20).dangerlvlmax}`,
        this.getBeesAmount(hive.cells.defense.master),
      ]);

    let minSize = 0;
    minSize = Math.max(minSize, this.anchor.x - 1);
    this.table(ans, this.anchor, undefined, minSize);
  }

  public statsLab(hive: Hive) {
    if (!hive.cells.lab) return;
    const lab = hive.cells.lab;
    if (lab.synthesizeTarget)
      this.label(
        `🧪 ${lab.prod ? lab.prod.res + " " + lab.prod.plan : "??"} -> ${
          lab.synthesizeTarget.res
        } ${lab.synthesizeTarget.amount}`,
        this.anchor
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

      this.table(ans, this.anchor, undefined);
    }
  }

  public textStyle(style: TextStyle = {}): TextStyle {
    return _.defaults(style, {
      color: "#e3e3de",
      font: `${TEXT_SIZE} Trebuchet MS `,
      stroke: undefined,
      strokeWidth: 0.01,
      backgroundColor: undefined,
      backgroundPadding: 0.3,
      align: "left",
      opacity: 0.8,
    });
  }

  // #endregion Public Methods (10)

  // #region Protected Methods (7)

  protected formatNumber(num: number) {
    const prefixS = num < 0 ? "-" : "";
    num = Math.abs(num);
    let postfixS = "";
    if (num > 1_000_000) {
      num = Math.round(num / 100_000) / 10;
      postfixS = "M";
    } else if (num > 100_000) {
      num = Math.round(num / 1_000);
      postfixS = "K";
    } else if (num > 10_000) {
      num = Math.round(num / 100) * 10;
      postfixS = "K";
    }
    return prefixS + num + postfixS;
  }

  protected getBeesAmount(
    master:
      | { waitingForBees: number; beesAmount: number; targetBeeCount: number }
      | undefined
  ): string {
    if (!master) return ":";
    return `: ${master.waitingForBees ? "(" : ""}${master.beesAmount}${
      master.waitingForBees ? "+" + master.waitingForBees + ")" : ""
    }/${master.targetBeeCount}`;
  }

  protected getTextLength(str: string) {
    return TEXT_SIZE * str.length * 0.52;
  }

  protected label(
    label: string,
    info: VisInfo,
    style: TextStyle = {},
    minSize: number = 1,
    maxSize: number = 15
  ) {
    const textLen = this.getTextLength(label);
    const xMax =
      info.x +
      Math.min(Math.max(minSize, textLen + 0.5), maxSize) *
        (style.align === "right" ? -1 : 1);
    const yMax = info.y + TEXT_HEIGHT + 0.5;
    info.vis.text(
      label,
      info.x + 0.25 * (style.align === "right" ? -1 : 1),
      yMax - 0.26,
      this.textStyle(style)
    );
    info.vis.poly([
      [info.x, info.y],
      [info.x, yMax],
      [xMax, yMax],
      [xMax, info.y],
      [info.x, info.y],
    ]);
    this.objectMoveAnchor({ y: yMax }, true);
    return { x: xMax, y: yMax };
  }

  protected progressbar(
    label: string,
    info: VisInfo,
    progress: number,
    style: TextStyle = {},
    minSize: number = 1,
    maxSize: number = 15
  ) {
    const [x, y] = [info.x, info.y];
    const lab = this.label(label, info, style, minSize, maxSize);
    const xMin = style.align === "right" ? lab.x : info.x;
    const xMax =
      xMin +
      (lab.x - x) * Math.min(1, progress) * (style.align === "right" ? -1 : 1);
    info.vis.poly(
      [
        [xMin, y],
        [xMin, lab.y],
        [xMax, lab.y],
        [xMax, y],
        [xMin, y],
      ],
      {
        fill: "#ffdd80",
        stroke: undefined,
        opacity: progress >= 1 ? 0.5 : 0.3,
      }
    );
    return lab;
  }

  protected table(
    strings: string[][],
    info: VisInfo,
    style: TextStyle = {},
    minSize: number = 1,
    maxSize: number = Infinity,
    align: "center" | "right" | "left" = "left",
    snap: "bottom" | "top" = "top"
  ) {
    const pad = 0.2;

    let label;
    if (strings.length > 0 && strings[0].length === 1)
      label = strings.shift()![0];

    const widths: number[] = [];
    _.forEach(strings, (s) => {
      for (let i = 0; i < s.length; ++i) {
        if (!widths[i]) widths[i] = 0;
        widths[i] = Math.max(
          widths[i],
          this.getTextLength(s[i]) + (s.length === i + 1 ? 0.05 : 0.2)
        );
      }
    });

    let xMin = info.x;
    const len = Math.min(
      Math.max(_.sum(widths) + pad * widths.length + pad, minSize),
      maxSize
    );
    if (align === "center") xMin = info.x - len / 2;
    if (align === "right") xMin = info.x - len;
    const xMax = xMin + len;

    const yMin = info.y;
    let height =
      snap === "bottom"
        ? -pad * 2
        : pad + TEXT_HEIGHT + (label ? TEXT_HEIGHT + pad * 2 : 0);
    if (snap === "bottom") strings.reverse();

    _.forEach(strings, (s) => {
      let tab = pad * 2;
      for (let i = 0; i < s.length; ++i) {
        info.vis.text(s[i], xMin + tab, yMin + height, this.textStyle(style));
        tab += widths[i];
      }
      height += TEXT_HEIGHT * 1.2 * (snap === "bottom" ? -1 : 1);
    });
    let yMax = yMin + height - (snap !== "bottom" ? TEXT_HEIGHT - pad : 0);
    if (label) {
      const labelStyle = this.textStyle(style);
      labelStyle.align = "center";
      let yLabel;
      if (snap === "bottom") {
        yMax -= TEXT_HEIGHT + pad * 2;
        yLabel = yMax + TEXT_HEIGHT + pad * 2;
      } else {
        yLabel = yMin + TEXT_HEIGHT + 2 * pad;
      }
      info.vis.text(label, xMin + (xMax - xMin) / 2, yLabel - pad, labelStyle);
      info.vis.poly(
        [
          [xMin, yLabel],
          [xMin, yLabel - TEXT_HEIGHT - pad * 2],
          [xMax, yLabel - TEXT_HEIGHT - pad * 2],
          [xMax, yLabel],
        ],
        {
          fill: "#ffdd80",
          stroke: undefined,
          opacity: 0.3,
        }
      );
    }
    info.vis.poly([
      [xMin, yMin],
      [xMin, yMax],
      [xMax, yMax],
      [xMax, yMin],
      [xMin, yMin],
    ]);
    this.objectMoveAnchor(
      { x: align === "right" ? info.x : xMax, y: yMax },
      true
    );
    return { x: align === "right" ? info.x : xMax, y: yMax };
  }

  // #endregion Protected Methods (7)

  // #region Private Methods (10)

  private _render() {
    const drainData = (vis: RoomVisual, ref: string) => {
      if (!this.objectBusy(ref)) {
        delete this.caching[ref];
        return;
      }
      _.forEach(this.caching[ref]!.data, (c) => vis.import(c));
    };

    const addGlobal = (vis: RoomVisual) => {
      _.forEach(Object.values(GLOBAL_VISUALS_REF), (globalRef) =>
        drainData(vis, globalRef)
      );
    };

    const everyGlobal = _.some(
      Object.keys(this.caching),
      (ref) =>
        this.objectBusy(ref) && !Object.values(GLOBAL_VISUALS_REF).includes(ref)
    );

    if (everyGlobal) addGlobal(new RoomVisual());

    for (const ref in this.caching) {
      const vis = new RoomVisual(ref);
      drainData(vis, ref);
      if (!everyGlobal && !this.objectBusyNexTick(ref)) addGlobal(vis);
    }
  }

  private battleInfo() {
    const battleInfo: string[][] = [
      ["siedge squads"],
      ["", "🎯", " ☠️❗", "💀", "🐝"],
    ];
    _.forEach(Apiary.war.squads, (squad) => {
      const roomInfo = Apiary.intel.getInfo(squad.pos.roomName, 500);
      const siedge = Apiary.war.siedge[squad.pos.roomName];
      battleInfo.push([
        squad.ref.slice(0, 4) + " ",
        " " + squad.pos.roomName,
        siedge ? "" + siedge.towerDmgBreach : "NaN",
        " " + roomInfo.enemies.length,
        this.getBeesAmount(squad),
      ]);
    });
    if (battleInfo.length > 2)
      this.table(battleInfo, this.anchor, undefined, 10, 15, "center");
  }

  private createHive(roomName: string) {
    const hive = Apiary.hives[roomName];
    if (!hive.controller) return;

    const fakeRef = roomName + "_" + Apiary.intTime;

    this.objectNew({ x: 1, y: 1 }, fakeRef);
    this.statsHive(hive);
    this.statsNetwork(hive);
    this.statsLab(hive);
    this.statsFactory(hive);
    this.statsNukes(hive);

    const hiveVisuals = this.anchor.vis;

    _.forEach(hive.annexNames, (annexName) => {
      if (Apiary.hives[annexName]) return;
      if (this.objectBusy(annexName)) return;
      this.objectNew({}, annexName);
      this.anchor.vis = hiveVisuals;
    });

    if (this.objectBusy(roomName)) return;

    this.objectNew({ x: 1, y: 1 }, roomName);
    this.anchor.vis = hiveVisuals;
    this.nukeInfo(hive);
    this.spawnInfo(hive);
  }

  private emptyAnchor(
    pos: { x?: number; y?: number },
    ref: string,
    keepInMemory: number
  ) {
    this.anchor = {
      vis: new RoomVisual(makeId(8)),
      ref,
      x: pos.x || 0,
      y: pos.y || 0,
      keepInMemory,
    };
  }

  private global() {
    const minLen = 6.2;
    if (!Apiary.useBucket)
      this.label("LOW CPU", this.anchor, { align: "right" }, minLen);
    this.progressbar(
      Math.round(Game.cpu.getUsed() * 100) / 100 + " : CPU",
      this.anchor,
      Game.cpu.getUsed() / Game.cpu.limit,
      { align: "right" },
      minLen
    );
    this.progressbar(
      (Game.cpu.bucket === 10000 ? "10K" : Math.round(Game.cpu.bucket)) +
        " : BUCKET",
      this.anchor,
      Game.cpu.bucket / 10000,
      { align: "right" },
      minLen
    );
    this.progressbar(
      Game.gcl.level + "→" + (Game.gcl.level + 1) + " : GCL",
      this.anchor,
      Game.gcl.progress / Game.gcl.progressTotal,
      { align: "right" },
      minLen
    );
    const heapStat = Game.cpu.getHeapStatistics && Game.cpu.getHeapStatistics();
    if (heapStat)
      this.progressbar(
        "HEAP",
        this.anchor,
        heapStat.used_heap_size / heapStat.total_available_size,
        { align: "right" },
        minLen
      );
  }

  private miningInfo() {
    const miningInfo: string[][] = [["mining sites"], ["", "🎯", "❓", "🐝"]];
    for (const hiveName in Apiary.hives) {
      const corMine = Apiary.hives[hiveName].cells.corridorMining;
      if (corMine) {
        if (corMine.powerSites.length || corMine.depositSites.length)
          miningInfo.push([
            "",
            hiveName,
            "",
            this.getBeesAmount(corMine.master),
          ]);
        let extraDeposits = 0;
        _.forEach(corMine.depositSites, (m) => {
          if (!m.miners.beesAmount && !m.pickup.beesAmount && !m.shouldSpawn) {
            ++extraDeposits;
            return;
          }
          let ref = m.ref;
          if (m.ref.indexOf("_") !== -1) ref = m.ref.split("_")[1];
          miningInfo.push([
            ref.slice(0, 6),
            " " + m.pos.roomName,
            " ⛏️",
            this.getBeesAmount(m.miners) + " " + this.getBeesAmount(m.pickup),
          ]);
        });
        let extraPower = 0;
        _.forEach(corMine.powerSites, (m) => {
          if (!m.beesAmount && !m.shouldSpawn) {
            ++extraPower;
            return;
          }
          let ref = m.ref;
          if (m.ref.indexOf("_") !== -1) ref = m.ref.split("_")[1];
          miningInfo.push([
            ref.slice(0, 6),
            " " + m.pos.roomName,
            " 🔴",
            this.getBeesAmount(m),
          ]);
        });
        if (extraDeposits || extraPower) {
          let s = " + ";
          if (extraDeposits) s += extraDeposits + "⛏️";
          if (extraPower) s += (extraDeposits ? " " : "") + extraPower + "🔴";
          miningInfo.push([s]);
        }
      }
    }
    if (miningInfo.length > 2)
      this.table(miningInfo, this.anchor, undefined, 10, 15, "center");
  }

  private nukeInfo(hive: Hive) {
    _.forEach(hive.cells.defense.nukes, (nuke) => {
      const n = nuke.pos;
      const xMin = n.x - 2.5;
      const xMax = n.x + 2.5;
      const yMin = n.y - 2.5;
      const yMax = n.y + 2.5;
      this.anchor.vis.poly(
        [
          [xMin, yMin],
          [xMin, yMax],
          [xMax, yMax],
          [xMax, yMin],
          [xMin, yMin],
        ],
        { stroke: "#F1AFA1" }
      );
      this.anchor.vis.circle(n.x, n.y, { fill: "#000000" });
    });
  }

  /** saves the objects currently on the anchor */
  private objectExport() {
    const ref = this.anchor.ref;
    const keepInMemory = this.anchor.keepInMemory;
    if (!this.objectBusy(ref))
      this.caching[ref] = {
        data: [],
        keepUntil: Apiary.intTime + keepInMemory,
      };
    const ex = this.caching[ref]!;
    ex.data.push(this.anchor.vis.export() || "");
    ex.keepUntil = Math.max(ex.keepUntil, keepInMemory);
  }

  private statsNukes(hive: Hive) {
    _.forEach(hive.cells.defense.nukes, (nuke) => {
      const percent = 1 - nuke.timeToLand / NUKE_LAND_TIME;
      this.progressbar(
        `☢ ${nuke.launchRoomName} ${nuke.timeToLand} : ${
          Math.round(percent * 1000) / 10
        }%`,
        this.anchor,
        percent,
        undefined,
        9.65
      );
    });
  }

  private visualizePlanner() {
    const ch = Apiary.colony.planner.checking;
    if (!ch) return;

    const hiveName = ch.roomName;
    if (this.objectBusy(hiveName)) return;

    // add structures
    const ap = ch.active;

    this.objectNew({}, hiveName);
    for (const pos of ch.positions)
      this.anchor.vis.circle(pos.x, pos.y, {
        fill: "#FFC82A",
        opacity: 0.5,
        stroke: "#FFA600",
        strokeWidth: 1,
      });

    this.table(
      [["                  ", "current", "best", "      "]].concat(
        _.map(
          ch.active.metrics as unknown as { [ref: string]: number },
          (value, ref) =>
            [
              ref || "NaN",
              "" + value,
              ch.best.metrics[ref as "ramps"] || "NaN",
            ] as string[]
        )
      ),
      this.anchor
    );

    // table: number of sources/minerals by roomName
    const roomResources = _.map(
      _.unique(
        _.map(ch.sources, (p) => p.roomName).concat(
          _.map(ch.minerals, (p) => p.roomName)
        )
      ),
      (roomName) => [
        roomName,
        "" + ch.sources.filter((p) => p.roomName === roomName).length,
        "" + ch.minerals.filter((p) => p.roomName === roomName).length,
      ]
    );
    this.table(
      [["name  ", "sources", "minerals"]].concat(roomResources),
      this.anchor
    );

    // add info about cells
    for (const [cellRef, value] of Object.entries(ap.posCell)) {
      const SIZE = 0.3;
      const pos = { x: value[0], y: value[1] };

      const outEdge = { width: 0.15, color: "#010B13" };
      this.anchor.vis.line(
        pos.x - SIZE,
        pos.y - SIZE,
        pos.x + SIZE,
        pos.y + SIZE,
        outEdge
      );
      this.anchor.vis.line(
        pos.x + SIZE,
        pos.y - SIZE,
        pos.x - SIZE,
        pos.y + SIZE,
        outEdge
      );

      const style: LineStyle = { opacity: 0.7 };
      switch (cellRef) {
        case prefix.laboratoryCell:
          style.color = "#44CCFF"; // +
          break;
        case prefix.excavationCell:
          style.color = "#FFC82A";
          break;
        case prefix.defenseCell:
          style.color = "#FFA600"; // +
          break;
        case prefix.powerCell:
          style.color = "#F53547"; // +
          break;
        case prefix.fastRefillCell:
          style.color = "#19304D";
          break;
        case prefix.upgradeCell:
          style.color = "#179121"; // +
          break;
        default:
          if (
            cellRef.slice(0, prefix.resourceCells.length) ===
            (prefix.resourceCells as string)
          )
            style.color = "#FFE699"; // +
      }

      this.anchor.vis.line(
        pos.x - SIZE,
        pos.y - SIZE,
        pos.x + SIZE,
        pos.y + SIZE,
        style
      );
      this.anchor.vis.line(
        pos.x + SIZE,
        pos.y - SIZE,
        pos.x - SIZE,
        pos.y + SIZE,
        style
      );
    }

    for (const roomName in ap.rooms) {
      if (this.objectBusy(roomName)) continue;
      const plan = ap.rooms[roomName].compressed;
      this.objectNew({}, roomName);

      const vis = this.anchor.vis;
      const hive = Apiary.hives[roomName];
      if (hive) {
        this.nukeInfo(hive);
        _.forEach(hive.cells.defense.getNukeDefMap()[0], (p) =>
          vis.structure(p.pos.x, p.pos.y, STRUCTURE_RAMPART)
        );
      }

      for (const sType in plan) {
        const structureType = sType as BuildableStructureConstant;
        for (const value of plan[structureType]!.que) {
          if (value !== PLANNER_STAMP_STOP)
            vis.structure(value[0], value[1], structureType);
        }
      }
      vis.connectRoads();
    }
  }

  // #endregion Private Methods (10)
}
