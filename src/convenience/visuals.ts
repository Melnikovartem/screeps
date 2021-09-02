import { profile } from "../profiler/decorator";
import { UPDATE_EACH_TICK, DEVELOPING } from "../settings";

const TEXT_SIZE = 0.8;
const TEXT_WIDTH = TEXT_SIZE * 0.465;
const TEXT_HEIGHT = TEXT_SIZE * 0.9;

@profile
export class Visuals {

  caching: { [id: string]: string } | null = null;
  anchor: { x: number, y: number, roomName?: string | undefined } = { x: 49, y: 1 };

  getAnchor(x?: number, roomName?: string | null, y?: number) {
    if (x !== undefined)
      this.anchor.x = x;
    this.anchor.y = y === undefined ? this.anchor.y + 0.2 : y >= 0 ? y : this.anchor.y;
    if (roomName !== undefined)
      this.anchor.roomName = roomName ? roomName : undefined;
    return this.anchor;
  }

  create() {
    if (Game.time % Memory.settings.framerate === 0 || !this.caching || UPDATE_EACH_TICK) {
      if (!this.caching)
        this.caching = {};

      this.anchor = this.progressbar("CPU", this.getAnchor(49, null, 1), Game.cpu.getUsed() / Game.cpu.limit, { align: "right" }, 6);
      // bucket size same as PIXEL_CPU_COST
      this.anchor = this.progressbar("BUCKET", this.getAnchor(49), Game.cpu.bucket / 10000, { align: "right" }, 6);
      this.anchor = this.progressbar("GCL " + Game.gcl.level + "→" + (Game.gcl.level + 1), this.getAnchor(49), Game.gcl.progress / Game.gcl.progressTotal, { align: "right" }, 6);
      let heapStat = Game.cpu.getHeapStatistics && Game.cpu.getHeapStatistics();
      if (heapStat) {
        this.anchor = this.progressbar("HEAP", this.getAnchor(49), heapStat.used_heap_size / heapStat.total_available_size, { align: "right" }, 6);
      }

      let battleInfo: string[][] = [["bee squads"], ["", "🎯", "💀", "🐝"]];
      for (const name in Apiary.hives) {
        let stats = this.statsBattle(name);
        if (stats.length > 0) {
          battleInfo.push(["", name]);
          battleInfo = battleInfo.concat(stats);
        }
      }
      this.anchor = this.table(battleInfo, this.getAnchor(25, null, 1), undefined, undefined, undefined, "center");

      if (Memory.settings.framerate > 1)
        this.caching["global"] = new RoomVisual().export();

      for (const name in Apiary.hives) {
        this.statsHives(name);

        this.visualizeEnergy(name);

        this.caching[name] = new RoomVisual(name).export();
        _.forEach(Apiary.hives[name].annexNames, (annex) => {
          new RoomVisual(annex).import(this.caching![name]);
        });
      }
    } else {
      new RoomVisual().import(this.caching["global"]);
      for (const name in Apiary.hives)
        if (this.caching[name]) {
          new RoomVisual(name).import(this.caching[name]);
          _.forEach(Apiary.hives[name].annexNames, (annex) => {
            new RoomVisual(annex).import(this.caching![name]);
          });
        }
    }
  }

  visualizeEnergy(hiveName: string) {
    if (!Apiary.logger)
      return;
    let report = Apiary.logger.reportEnergy(hiveName);
    let ans: string[][] = [["energy"], ["", "⚡", "💸"]];
    let overAll = 0;
    let prep = (rate: number): string => String(Math.round(rate * 100) / 100);

    ans.push(["  📈income"]);
    for (let ref in report)
      if (report[ref].profit > 0) {
        overAll += report[ref].profit;
        ans.push([ref, report[ref].revenue !== undefined ? prep(report[ref].revenue!) : "", prep(report[ref].profit)]);
      }


    ans.push(["  📉expenditure"]);
    for (let ref in report)
      if (report[ref].profit < 0) {
        overAll += report[ref].profit;
        ans.push([ref, report[ref].revenue !== undefined ? prep(report[ref].revenue!) : "", prep(report[ref].profit)]);
      }

    ans.splice(2, 0, ["  💎🙌", "", prep(overAll)]);

    this.anchor = this.table(ans, this.getAnchor(0.5, undefined, 48.5),
      undefined, undefined, undefined, "left", "bottom");
    return;
  }

  statsBattle(hiveName: string): string[][] {
    let orders = _.filter(Apiary.orders, (o) => o.hive.roomName === hiveName && o.flag.color !== COLOR_PURPLE && o.master);
    let ans: string[][] = [];
    _.forEach(orders, (order) => {
      let roomInfo = Apiary.intel.getInfo(order.pos.roomName);
      let info = [order.ref, " " + order.pos.roomName, " " + roomInfo.enemies.length];
      if (order.master) {
        info.push(`: ${order.master.waitingForBees ? "(" : ""}${order.master.beesAmount}${order.master.waitingForBees ?
          "+" + order.master.waitingForBees + ")" : ""}/${order.master.targetBeeCount}`)
      }
      ans.push(info);
    });
    return ans;
  }

  statsHives(hiveName: string) {
    let hive = Apiary.hives[hiveName];
    let ans: string[][] = [["hive " + hiveName], ["", "❓", "🐝"]];
    let cell;
    cell = hive.cells.spawn;
    if (cell) {
      if (hive.bassboost)
        ans.push(["spawn", "→" + hive.bassboost.roomName, ":"]);
      else
        ans.push(["spawn",
          Object.keys(hive.spawOrders).length ? ` ${Object.keys(hive.spawOrders).length}` : "",
          this.getBeesAmount(cell.master)]);
    }
    cell = hive.cells.storage;
    if (cell)
      ans.push(["storage",
        Object.keys(cell.requests).length ? ` ${Object.keys(cell.requests).length}` : "",
        this.getBeesAmount(cell.master)]);
    cell = hive.cells.dev;
    if (cell)
      ans.push(["develop",
        cell.sources.length ? ` ${Object.keys(cell.sources).length}` : "",
        this.getBeesAmount(cell.master)]);
    cell = hive.cells.excavation;
    if (cell) {
      ans.push(["excav",
        ` ${cell.quitefullContainers.length}/${_.sum(cell.resourceCells, (c) => c.container && c.operational && !c.link ? 1 : 0)}`,
        this.getBeesAmount(cell.master)]);

      let stats = { waitingForBees: 0, beesAmount: 0, targetBeeCount: 0 };
      let operational = 0;
      let all = 0;
      _.forEach(cell.resourceCells, (rcell) => {
        all += 1;
        operational += rcell.operational ? 1 : 0;
        if (rcell.master && rcell.perSecondNeeded) {
          stats.beesAmount += rcell.master.beesAmount;
          stats.waitingForBees += rcell.master.waitingForBees;
          stats.targetBeeCount += rcell.master.targetBeeCount;
        }
      });
      ans.push(["resource", ` ${operational}/${all}`, this.getBeesAmount(stats)]);
    }

    let annexOrders = _.filter(Apiary.orders, (o) => o.hive === hive && /^annex_/.exec(o.ref))
    if (annexOrders.length) {
      let stats = { waitingForBees: 0, beesAmount: 0, targetBeeCount: 0 };
      let operational = 0;
      let all = 0;
      _.forEach(annexOrders, (o) => {
        all += 1;
        operational += o.acted ? 1 : 0;
        if (o.master) {
          stats.beesAmount += o.master.beesAmount;
          stats.waitingForBees += o.master.waitingForBees;
          stats.targetBeeCount += o.master.targetBeeCount;
        }
      });
      ans.push(["annex", ` ${operational}/${all}`, this.getBeesAmount(stats)]);
    }

    let constLen = hive.structuresConst.length;
    if (constLen > 0 || (hive.builder && hive.builder.beesAmount)) {
      ans.push(["build", (constLen ? ` C:${constLen}` : "")
        + (constLen ? ` R:${constLen}` : ""),
        this.getBeesAmount(hive.builder)])
    }

    ans.push(["upgrade",
      ` ${Math.floor(hive.room.controller!.progress / hive.room.controller!.progressTotal * 100)}%`,
      this.getBeesAmount(hive.cells.upgrade && hive.cells.upgrade.master)]);

    let minSize = 0;
    this.anchor = this.table(ans, this.getAnchor(1, hiveName, 1), undefined, minSize);
    minSize = Math.max(minSize, this.anchor.x - 1);

    let labCell = Apiary.hives[hiveName].cells.lab;
    if (labCell) {
      let labRequest = labCell.currentRequest;
      if (labRequest) {
        this.anchor = this.progressbar(`🧪 ${labRequest.res1} + ${labRequest.res2} => ${labRequest.res} ${labRequest.plan}`,
          this.getAnchor(1), 1 - (labRequest.current / labRequest.plan), undefined, minSize);
        minSize = Math.max(minSize, this.anchor.x - 1);
      }
      if (Object.keys(labCell.boostRequests).length) {
        let boosts: { [id: string]: { [id: string]: number } } = {};
        _.forEach(labCell.boostRequests, (rr) => _.forEach(rr, (r) => {
          if (!r.amount || !r.res)
            return;
          if (!boosts[r.type])
            boosts[r.type] = {};
          if (!boosts[r.type][r.res])
            boosts[r.type][r.res] = 0
          boosts[r.type][r.res] += r.amount;
        }));
        ans = [["boosts", "🧬", "🧪"]];
        for (let action in boosts)
          ans.push([action].concat(_.map(boosts[action], (num, res) => `${res}: ${num}`)));
        this.anchor = this.table(ans, this.getAnchor(1), undefined, minSize);
        minSize = Math.max(minSize, this.anchor.x - 1);
      }
    }
  }

  getBeesAmount(master: { waitingForBees: number, beesAmount: number, targetBeeCount: number } | undefined): string {
    if (!master)
      return ":";
    return `: ${master.waitingForBees ? "(" : ""}${master.beesAmount}${master.waitingForBees ?
      "+" + master.waitingForBees + ")" : ""}/${master.targetBeeCount}`
  }
  textStyle(style: TextStyle = {}): TextStyle {
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

  label(label: string, pos: { x: number, y: number, roomName?: string },
    style: TextStyle = {}, minSize: number = 1, maxSize: number = 15) {
    let vis = new RoomVisual(pos.roomName);
    let textLen = label.length * TEXT_WIDTH * 1.05;
    let xMax = pos.x + Math.min(Math.max(minSize, textLen + 0.5), maxSize) * (style.align === "right" ? -1 : 1);
    let yMax = pos.y + TEXT_HEIGHT + 0.5;
    vis.text(label, pos.x + 0.25 * (style.align === "right" ? -1 : 1), yMax - 0.26, this.textStyle(style));
    vis.poly([[pos.x, pos.y], [pos.x, yMax], [xMax, yMax], [xMax, pos.y], [pos.x, pos.y]]);
    return { x: xMax, y: yMax, roomName: pos.roomName };;
  }

  progressbar(label: string, pos: { x: number, y: number, roomName?: string }, progress: number,
    style: TextStyle = {}, minSize: number = 1, maxSize: number = 15) {
    let vis = new RoomVisual(pos.roomName);
    let lab = this.label(label, pos, style, minSize, maxSize);
    let xMin = style.align === "right" ? lab.x : pos.x;
    let xMax = xMin + (lab.x - pos.x) * Math.min(1, progress) * (style.align === "right" ? -1 : 1);
    vis.poly([[xMin, pos.y], [xMin, lab.y], [xMax, lab.y], [xMax, pos.y], [xMin, pos.y]], {
      fill: "#ffdd80",
      stroke: undefined,
      opacity: 0.3 + (progress > 1 ? Math.min((progress - 1) / 5, 0.7) : 0),
    });
    return lab;
  }

  table(strings: string[][], pos: { x: number, y: number, roomName?: string }, style: TextStyle = {},
    minSize: number = 1, maxSize: number = 20, align: "center" | "right" | "left" = "left", snap: "bottom" | "top" = "top") {
    if (DEVELOPING)
      pos.x += 2; // broken visuals @ xxScreeps server
    let vis = new RoomVisual(pos.roomName);
    let pad = 0.2;

    let label;
    if (strings.length > 0 && strings[0].length === 1)
      label = strings.shift()![0];

    let widths: number[] = [];
    _.forEach(strings, (s) => {
      for (let i = 0; i < s.length; ++i) {
        if (!widths[i])
          widths[i] = 0;
        widths[i] = Math.max(widths[i], s[i].length * TEXT_WIDTH + 0.6);
      }
    });

    let xMin = pos.x;
    let len = Math.min(Math.max(_.sum(widths) + pad * 2, minSize), maxSize);
    if (align === "center")
      xMin = pos.x - len / 2;
    if (align === "right")
      xMin = pos.x - len;
    let xMax = xMin + len;

    let yMin = pos.y;
    let height = snap === "bottom" ? -pad * 2 : pad + TEXT_HEIGHT + (label ? TEXT_HEIGHT + pad * 2 : 0);
    if (snap == "bottom")
      strings.reverse();

    _.forEach(strings, (s) => {
      let tab = pad;
      for (const i in s) {
        vis.text(s[i], xMin + tab, yMin + height, this.textStyle(style));
        tab += widths[i] + (widths[i] > 6 ? 0.2 : 0)
      }
      height += TEXT_HEIGHT * 1.2 * (snap === "bottom" ? -1 : 1);
    });
    let yMax = yMin + height - (snap !== "bottom" ? TEXT_HEIGHT - pad : 0);
    if (label) {
      let labelStyle = this.textStyle(style);
      labelStyle.align = "center";
      let yLabel;
      if (snap === "bottom") {
        yMax -= TEXT_HEIGHT + pad * 2;
        yLabel = yMax + TEXT_HEIGHT + pad * 2;
      } else {
        yLabel = yMin + TEXT_HEIGHT + 2 * pad;
      }
      vis.text(label, xMin + (xMax - xMin) / 2, yLabel - pad, labelStyle);
      vis.poly([[xMin, yLabel], [xMin, yLabel - TEXT_HEIGHT - pad * 2], [xMax, yLabel - TEXT_HEIGHT - pad * 2], [xMax, yLabel]], {
        fill: "#ffdd80",
        stroke: undefined,
        opacity: 0.3,
      });
    }
    vis.poly([[xMin, yMin], [xMin, yMax], [xMax, yMax], [xMax, yMin], [xMin, yMin]]);
    return { x: align === "center" ? xMax : pos.x, y: yMax, roomName: pos.roomName };
  }
}
