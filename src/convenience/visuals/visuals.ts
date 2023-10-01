import "./visluals-planning";

import type { Hive } from "hive/hive";
import { SWARM_MASTER } from "orders/swarm-nums";
import { profile } from "profiler/decorator";
import { hiveStates } from "static/enums";
import { makeId } from "static/utils";

import {
  DEFAULT_TEXTSTYLE,
  SPACING,
  TEXT_HEIGHT,
  TEXT_WIDTH,
  VISUAL_COLORS,
  VISUALS_SIZE_MAP,
} from "./visuals-constants";
import { globalStats } from "./visuals-global";
import {
  aidHive,
  mastersStateHive,
  resStateHive,
  statsFactory,
  statsLab,
  statsNukes,
} from "./visuals-hive";
import { visualizePlanner } from "./visuals-planner";

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
  // #region Properties (4)

  private globalStats = globalStats;
  private visualizePlanner = visualizePlanner;

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

  // #endregion Properties (4)

  // #region Private Accessors (1)

  private get framerate() {
    return Memory.settings.framerate;
  }

  // #endregion Private Accessors (1)

  // #region Public Methods (14)

  public formatNumber(num: number) {
    const prefixS = num < 0 ? "-" : "";
    num = Math.abs(num);
    let postfixS = "";
    if (num >= 1_000_000) {
      num = Math.round(num / 100_000) / 10;
      postfixS = "M";
    } else if (num >= 100_000) {
      num = Math.round(num / 1_000);
      postfixS = "K";
    } else if (num >= 5_000) {
      num = Math.round(num / 100) / 10;
      postfixS = "K";
    } else num = Math.round(num * 100) / 100;
    return prefixS + num + postfixS;
  }

  public getBeesAmount(master: {
    waitingForBees: number;
    beesAmount: number;
    targetBeeCount: number;
  }): string[] {
    const allBees =
      master.beesAmount + master.beesAmount + master.targetBeeCount;
    if (!allBees) return [];
    return [
      "" + (master.waitingForBees || ""),
      master.beesAmount + "/" + master.targetBeeCount,
    ];
  }

  public label(
    label: string,
    minSize: number = 1,
    maxSize: number = 15,
    addBox = true,
    style: TextStyle = {},
    anchor = this.anchor
  ) {
    const [x, y] = [anchor.x, anchor.y];

    const [width, height, padLeft, padTop] = this.getSizeLabel(
      label,
      minSize,
      maxSize,
      style
    );

    if (addBox) this.box(x, y, width, height);
    anchor.vis.text(label, x + padLeft, y + padTop, this.textStyle(style));

    const endY = y + height;
    this.objectMoveAnchor({ y: endY }, false, true);
    return { x: x + width, y: endY };
  }

  public objectBusy(ref: string) {
    const ex = this.caching[ref];
    return ex && ex.keepUntil >= Apiary.intTime;
  }

  public objectBusyNexTick(ref: string) {
    const ex = this.caching[ref];
    return ex && ex.keepUntil >= Apiary.intTime + 1;
  }

  /** reset anchor to default pos */
  public objectDefaultPos(roomName: string) {
    this.objectNew({ x: 1, y: 11.5 }, roomName);
  }

  public objectMoveAnchor(
    pos: { x?: number; y?: number },
    addXSpacing: boolean = false,
    addYSpacing: boolean = false
  ) {
    if (pos.x === undefined) pos.x = this.anchor.x;
    else if (addXSpacing) pos.x = pos.x + SPACING;
    if (pos.y === undefined) pos.y = this.anchor.y + SPACING;
    else if (addYSpacing) pos.y = pos.y + SPACING;

    this.anchor.x = pos.x;
    this.anchor.y = pos.y;
  }

  /**
   * @param pos {x: x, y: y} pos of new anchor. Any value can be ommited
   * @param roomName new roomName. by default anchor is kept within a tick
   * @param keepInMemory how long to keep in memory
   * @returns new anchor to stack visuals on
   */
  public objectNew(
    pos: { x?: number; y?: number },
    ref: string,
    keepInMemory = 0
  ) {
    this.objectExport();
    this.emptyAnchor(pos, ref, keepInMemory);
    return this.anchor;
  }

  public objectsWipe(ref: string) {
    this.caching[ref] = undefined;
    if (this.anchor.ref === ref) this.emptyAnchor({}, ref, -1);
  }

  public progressbar(
    label: string,
    progress: number,
    minSize?: number,
    maxSize?: number,
    style: TextStyle = {},
    anchor = this.anchor
  ) {
    const [x, y] = [anchor.x, anchor.y];
    const [width, height] = this.getSizeLabel(label, minSize, maxSize, style);

    const widthBar = width * Math.min(1, progress);

    // yellow part
    this.rect(x, y, widthBar, height, {
      fill: VISUAL_COLORS.hiveMain,
      opacity: progress >= 1 ? 0.5 : 0.3,
    });

    // grey part
    this.box(x + widthBar, y, width - widthBar, height, undefined, false);

    // stroke
    this.box(x, y, width, height, false, undefined);

    return this.label(label, minSize, maxSize, false, style, anchor);
  }

  public run() {
    if (this.framerate < 0) return;

    this.visualizePlanner();

    if (Apiary.intTime % this.framerate === 0) {
      if (Apiary.useBucket) {
        // heavy calcs
        for (const name in Apiary.hives) this.hiveVisuals(name);

        this.objectNew({ x: 30, y: 1 }, GLOBAL_VISUALS_REF.heavy);
        // this.battleInfo();
        // this.miningInfo();
      }

      // normal stuff
      this.objectNew({ x: 1, y: 1 }, GLOBAL_VISUALS_REF.main);
      this.logo();
      this.objectMoveAnchor({ x: 49, y: 1 });
      this.globalStats();
    }

    // export last uncommited objects
    this.objectExport();
    this._render();
  }

  public spawnInfo(hive: Hive) {
    const usedY: number[] = [];

    const style = this.textStyle({
      stroke: VISUAL_COLORS.hiveDark,
      strokeWidth: 0.07,
      opacity: 0.75,
      // backgroundColor: VISUAL_COLORS.hiveSupport,
      // backgroundPadding: padding,
    });

    _.forEach(hive.cells.spawn.spawns, (s) => {
      if (!s.spawning) return;
      let x = s.pos.x + 0.8;
      let y = s.pos.y - 0.6;
      if (usedY.indexOf(Math.round(y)) !== -1) {
        y = s.pos.y + 0.9;
        x = s.pos.x - 0.55;
        if (usedY.indexOf(Math.round(y)) !== -1) y = s.pos.y - 0.9;
      }
      usedY.push(Math.round(y));

      const beeName = s.spawning.name.slice(0, s.spawning.name.length - 5);
      const spawnReady = Math.round(
        (1 - s.spawning.remainingTime / s.spawning.needTime) * 100
      );
      const label = `⚒️ ${beeName} ${spawnReady}%`;

      this.objectMoveAnchor({ x, y });
      this.label(label, undefined, undefined, true, style);
    });
  }

  /**
   *
   * @param strings
   * @param header
   * @param align
   * @param spaceBetweenRows
   * @param spaceBetweenCols
   * @param style
   * @param info
   * @returns
   */
  public table(
    strings: string[][],
    header: string | undefined = undefined,
    align: "center" | "right" | "left" = "left",
    padBetweenRows = 0.2,
    padBetweenCols = 0.4,
    tableStyle: PolyStyle | false = {},
    headerStyle: PolyStyle | false = {
      fill: VISUAL_COLORS.hiveMain,
    },
    strokeStyle: PolyStyle | false = {},
    textStyle: TextStyle = {},
    anchor = this.anchor
  ) {
    const widths: number[] = [];

    _.forEach(strings, (row) => {
      for (let i = 0; i < row.length; ++i) {
        if (!widths[i]) widths[i] = 0;
        widths[i] = Math.max(widths[i], this.textSize(row[i])[0]);
      }
    });

    let width = _.sum(widths) + padBetweenCols * (widths.length + 1);
    if (header) {
      const headerWidth = this.textSize(header)[0] + padBetweenRows * 2;
      width = Math.max(width, headerWidth);
    }
    const rowHeight = TEXT_HEIGHT + padBetweenCols;
    const height = rowHeight * strings.length + padBetweenCols;

    let x = anchor.x;
    if (align === "center") x = anchor.x - width / 2;
    if (align === "right") x = anchor.x - width;
    const y = anchor.y;
    const headerHeight = header ? TEXT_HEIGHT + padBetweenCols * 2 : 0;

    if (header) {
      const labelStyle = this.textStyle(textStyle);
      labelStyle.align = "center";
      anchor.vis.text(
        header,
        x + width / 2,
        y + headerHeight - padBetweenCols,
        labelStyle
      );
      this.box(x, y, width, headerHeight, headerStyle, false);
    }

    this.box(x, y + headerHeight, width, height, tableStyle, false);
    this.box(x, y, width, height + headerHeight, false, strokeStyle);

    let currY = y + headerHeight + rowHeight;

    _.forEach(strings, (row) => {
      let currX = x + padBetweenRows;
      for (let i = 0; i < row.length; ++i) {
        anchor.vis.text(row[i], currX, currY, this.textStyle(textStyle));
        currX += widths[i] + padBetweenCols;
      }
      currY += rowHeight;
    });

    const endY = y + headerHeight + height;
    this.objectMoveAnchor({ y: endY }, false, true);
    return { x: x + width, y: endY };
  }

  public textStyle(style: TextStyle = {}): TextStyle {
    return _.defaults({ ...style }, DEFAULT_TEXTSTYLE);
  }

  // #endregion Public Methods (14)

  // #region Protected Methods (4)

  /** alias for default colors / boxes */
  protected box(
    x: number,
    y: number,
    w: number,
    h: number,
    fillStyle: PolyStyle | false = {},
    strokeStyle: PolyStyle | false = {}
  ) {
    if (fillStyle) {
      if (fillStyle.fill === undefined) fillStyle.fill = VISUAL_COLORS.gray;
      if (fillStyle.opacity === undefined) fillStyle.opacity = 0.3;
      this.rect(x, y, w, h, fillStyle);
    }
    if (strokeStyle) {
      if (strokeStyle.stroke === undefined)
        strokeStyle.stroke = VISUAL_COLORS.hiveMain;
      if (strokeStyle.opacity === undefined) strokeStyle.opacity = 0.3;
      this.rect(x, y, w, h, strokeStyle);
    }
  }

  protected nukeInfo(hive: Hive) {
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
        { stroke: VISUAL_COLORS.nuke.edge }
      );
      this.anchor.vis.circle(n.x, n.y, { fill: VISUAL_COLORS.nuke.center });
    });
  }

  /** proper rectangle */
  protected rect(
    x: number,
    y: number,
    w: number,
    h: number,
    style: PolyStyle = {}
  ) {
    if (style.stroke === undefined) style.stroke = "";
    this.anchor.vis.poly(
      [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
        [x, y],
      ],
      style
    );
  }

  protected textSize(str: string): [number, number] {
    const sizes = _.map(str, (s) => {
      const ex = VISUALS_SIZE_MAP[s];
      if (ex) return ex;
      return [TEXT_WIDTH, TEXT_HEIGHT];
    });

    const width = _.sum(sizes, (s) => s[0]);
    const height = _.max(_.map(sizes, (s) => s[1]));
    return [width, height];
  }

  // #endregion Protected Methods (4)

  // #region Private Methods (7)

  private _render() {
    const drainData = (vis: RoomVisual, ref: string) => {
      const diff = Apiary.intTime - (this.caching[ref]?.keepUntil || 0);
      if (diff > this.framerate) {
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

  /* private battleInfo() {
    const battleInfo: string[][] = [["", "🎯", " ☠️❗", "💀", "🐝"]];
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
    if (battleInfo.length > 1)
      this.table(battleInfo, "siedge squads", "center");
  } */
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

  private getSizeLabel(
    label: string,
    minSize = 1,
    maxSize = 15,
    style: TextStyle = {}
  ) {
    let [width, height] = this.textSize(label);
    width =
      Math.min(Math.max(minSize, width + 0.5), maxSize) *
      (style.align === "right" ? -1 : 1);
    height += 0.5;
    const padLeft = 0.25 * (style.align === "right" ? -1 : 1);
    const padTop = height - 0.26;
    return [width, height, padLeft, padTop];
  }

  private hiveVisuals(roomName: string) {
    // if want to keep visuals in annex can preLoad
    // in fakeRef = roomName + "_" + Apiary.intTime
    if (this.objectBusy(roomName)) return;

    const hive = Apiary.hives[roomName];
    if (!hive.controller) return;

    this.objectDefaultPos(roomName);

    const [x, y] = [this.anchor.x, this.anchor.y];
    let xRight = x;
    const allY = [];

    xRight = this.statsHive(hive).x;
    allY.push(this.anchor.y);

    this.objectMoveAnchor({ y, x: xRight }, true);
    xRight = mastersStateHive(this, hive).x;
    allY.push(this.anchor.y);

    this.objectMoveAnchor({ y, x: xRight }, true);
    resStateHive(this, hive);
    allY.push(this.anchor.y);

    this.objectDefaultPos(roomName);
    this.objectMoveAnchor({ y: _.max(allY) });

    aidHive(this, hive);
    statsFactory(this, hive);
    statsLab(this, hive);

    statsNukes(this, hive);

    // copy info to annexeses
    const hiveVisuals = this.anchor.vis;
    _.forEach(hive.annexNames, (annexName) => {
      if (Apiary.hives[annexName]) return;
      if (this.objectBusy(annexName)) return;
      this.objectDefaultPos(annexName);
      this.anchor.vis = hiveVisuals;
    });

    // room specific stuff
    this.objectDefaultPos(roomName);
    this.nukeInfo(hive);
    this.spawnInfo(hive);
  }

  private logo() {
    this.anchor.vis.rect(this.anchor.x, this.anchor.y, 10, 10, {
      fill: VISUAL_COLORS.hiveSupport,
      opacity: 0.3,
    });
  }

  /* private miningInfo() {
    const miningInfo: string[][] = [["", "🎯", "❓", "🐝"]];
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
    if (miningInfo.length > 2) this.table(miningInfo, "mining sites", "center");
  } */

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

  private statsHive(hive: Hive) {
    let hiveState = "❔";
    switch (hive.state) {
      case hiveStates.economy:
        hiveState = "💹";
        break;
      case hiveStates.lowenergy:
        hiveState = "📉";
        break;
      case hiveStates.nospawn:
        hiveState = "🚨";
        break;
      case hiveStates.nukealert:
        hiveState = "☢️";
        break;
      case hiveStates.battle:
        hiveState = "⚔️";
        break;
    }
    const header = `hive ${hive.roomName} ${hiveState}`;
    const info: string[][] = [];

    info.push([
      "walls health",
      this.formatNumber(hive.cells.build.wallTargetHealth),
    ]);
    info.push([
      "build costs",
      this.formatNumber(hive.cells.build.sumCost) +
        "/" +
        hive.cells.build.structuresConst.length,
    ]);
    let spawnInfo = "" + hive.cells.spawn.spawnQue.length || "";
    if (hive.bassboost) {
      const bassQue = hive.bassboost.cells.spawn.spawnQue;
      const formThisHive = bassQue.filter(
        (r) => Apiary.masters[r.master]?.hiveName === hive.roomName
      ).length;
      spawnInfo = `→${hive.bassboost.roomName} ${formThisHive}/${bassQue.length}`;
    }
    info.push(["spawn que", spawnInfo]);

    const storageQue = Object.keys(hive.cells.storage.requests).length;
    const nonRefilling = _.filter(
      hive.cells.storage.requests,
      (r) => r.priority
    ).length;
    info.push(["storage que", `${nonRefilling}/${storageQue}`]);

    if (hive.phase > 0) {
      const fullCells = hive.cells.excavation.quitefullCells.length;
      const needHauling = _.filter(
        hive.cells.excavation.resourceCells,
        (c) => c.operational && !c.link
      ).length;
      info.push(["excav que", `${fullCells}/${needHauling}`]);
    }

    const addSats = (
      ref: string,
      stats: { all: number; operational: number }
    ) => {
      if (!stats.all) return;
      info.push([ref, `${stats.operational}/${stats.all}`]);
    };

    const stasRes = { all: 0, operational: 0 };
    _.forEach(hive.cells.excavation.resourceCells, (s) => {
      stasRes.all += 1;
      stasRes.operational += s.operational ? 1 : 0;
    });
    addSats("resources", stasRes);

    const statsAnnex = { all: 0, operational: 0 };
    const statsSk = { all: 0, operational: 0 };
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
      stats.all += 1;
      stats.operational += s.master.targetBeeCount ? 1 : 0;
    });
    addSats("annex", statsAnnex);
    addSats("sk", statsSk);

    if (
      hive.isBattle ||
      hive.cells.defense.master.beesAmount ||
      hive.cells.defense.master.waitingForBees
    )
      info.push([
        "defense lvl",
        "" + Apiary.intel.getInfo(hive.roomName, 20).dangerlvlmax,
      ]);
    return this.table(info, header);
  }

  // #endregion Private Methods (7)
}
