import { profile } from "./profiler/decorator";
import { UPDATE_EACH_TICK } from "./settings";

const TEXT_SIZE = 0.8;
const TEXT_WIDTH = TEXT_SIZE * 0.5;
const TEXT_HEIGHT = TEXT_SIZE * 0.9;

@profile
export class Visuals {

  caching: { [id: string]: string } | null = null;

  create() {
    if (Game.time % Memory.settings.framerate == 0 || !this.caching || UPDATE_EACH_TICK) {
      if (!this.caching)
        this.caching = {};

      let ans: { x: number, y: number, roomName: undefined | string } = { x: 42, y: 1, roomName: undefined };
      ans = this.progressbar("CPU", ans, Game.cpu.getUsed() / 20, { align: "right" }, 6);
      ans.x = 42;
      ans.y += + 0.2;
      ans = this.progressbar("BUCKET", ans, Game.cpu.bucket / 10000, { align: "right" }, 6);
      ans.x = 42;
      ans.y += + 0.2;
      ans = this.progressbar("GCL " + Game.gcl.level + "→" + (Game.gcl.level + 1), ans, Game.gcl.progress / Game.gcl.progressTotal, { align: "right" }, 6);
      ans.x = 42;
      ans.y += + 0.2;
      let heapStat = Game.cpu.getHeapStatistics && Game.cpu.getHeapStatistics();
      if (heapStat) {
        ans = this.progressbar("HEAP", ans, heapStat.used_heap_size / heapStat.total_available_size, { align: "right" }, 6);
        ans.x = 42;
        ans.y += + 0.2;
      }

      let battleInfo: string[][] = [["bee squads"], ["", "🎯", "💀", "🐝"]];
      for (const name in Apiary.hives) {
        let stats = this.statsBattle(name);
        if (stats.length > 0) {
          battleInfo.push(["", name]);
          battleInfo = battleInfo.concat(stats);
        }
      }
      ans = { x: 25, y: 1, roomName: undefined };
      this.table(battleInfo, ans, undefined, undefined, undefined, "center");

      if (Memory.settings.framerate > 1)
        this.caching["global"] = new RoomVisual().export();

      for (const name in Apiary.hives) {
        let minSize = 0;
        ans = { x: 1, y: 1, roomName: name };
        ans = this.table(this.statsHives(name), ans, undefined, minSize);
        minSize = Math.max(minSize, ans.x - 1);
        ans.x = 1;
        ans.y += + 0.2;

        let labReuest = Apiary.hives[name].cells.lab && Apiary.hives[name].cells.lab!.currentRequest;
        if (labReuest && labReuest.plan) {
          ans = this.progressbar(`🧪 ${labReuest.res1} + ${labReuest.res2} => ${labReuest.res} ${labReuest.plan}`,
            ans, 1 - (labReuest.current / labReuest.plan), undefined, minSize);
          minSize = Math.max(minSize, ans.x - 1);
          ans.x = 1;
          ans.y += + 0.2;
        }

        this.caching[name] = new RoomVisual(name).export();
        _.forEach(Apiary.hives[name].annexNames, (annex) => {
          new RoomVisual(annex).import(this.caching![name]);
          if (Memory.settings.framerate > 1)
            this.caching![annex] = this.caching![name];
        });
      }
    } else {
      new RoomVisual().import(this.caching["global"]);
      for (const name in this.caching)
        new RoomVisual(name).import(this.caching[name]);
    }
  }

  statsBattle(hiveName: string): string[][] {
    let orders = _.filter(Apiary.orders, (o) => o.hive.roomName == hiveName && o.flag.color == COLOR_RED);
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

  statsHives(hiveName: string): string[][] {
    let hive = Apiary.hives[hiveName];
    let ans: string[][] = [["hive " + hiveName], ["", "❓", "🐝"]];
    let cell;
    cell = hive.cells.spawn;
    if (cell) {
      let ss = ["spawn"];
      if (hive.bassboost) {
        ss.push("→" + hive.bassboost.roomName);
        ss.push(":");
      } else {
        ss.push(Object.keys(hive.spawOrders).length ? ` ${Object.keys(hive.spawOrders).length}` : "");
        if (cell.master)
          ss.push(`: ${cell.master.waitingForBees ? "(" : ""}${cell.master.beesAmount}${cell.master.waitingForBees ?
            "+" + cell.master.waitingForBees + ")" : ""}/${cell.master.targetBeeCount}`);
      }
      ans.push(ss);
    }
    cell = hive.cells.storage;
    if (cell) {
      let ss = ["storage"];
      ss.push(Object.keys(cell.requests).length ? ` ${Object.keys(cell.requests).length}` : "");
      if (cell.master)
        ss.push(`: ${cell.master.waitingForBees ? "(" : ""}${cell.master.beesAmount}${cell.master.waitingForBees ?
          "+" + cell.master.waitingForBees + ")" : ""}/${cell.master.targetBeeCount}`);
      ans.push(ss);
    }
    cell = hive.cells.dev;
    if (cell) {
      let ss = ["develop"];
      ss.push(cell.sources.length ? ` ${Object.keys(cell.sources).length}` : "");
      if (cell.master)
        ss.push(`: ${cell.master.waitingForBees ? "(" : ""}${cell.master.beesAmount}${cell.master.waitingForBees ?
          "+" + cell.master.waitingForBees + ")" : ""}/${cell.master.targetBeeCount}`);
      ans.push(ss);
    }
    cell = hive.cells.excavation;
    if (cell) {
      let ss = ["excav"];
      ss.push(` ${cell.quitefullContainers.length}/${_.sum(cell.resourceCells, (c) => c.container && c.operational && !c.link ? 1 : 0)}`)
      if (cell.master)
        ss.push(`: ${cell.master.waitingForBees ? "(" : ""}${cell.master.beesAmount}${cell.master.waitingForBees ?
          "+" + cell.master.waitingForBees + ")" : ""}/${cell.master.targetBeeCount}`);
      ans.push(ss);

      let beesAmount = 0;
      let waitingForBees = 0;
      let targetBeeCount = 0;
      let operational = 0;
      let all = 0;
      _.forEach(cell.resourceCells, (rcell) => {
        all += 1;
        operational += rcell.operational ? 1 : 0;
        if (rcell.master && rcell.perSecondNeeded) {
          beesAmount += rcell.master.beesAmount;
          waitingForBees += rcell.master.waitingForBees;
          targetBeeCount += rcell.master.targetBeeCount;
        }
      });
      ss = ["resource", ` ${operational}/${all}`, `: ${waitingForBees ? "(" : ""}${beesAmount}${
        waitingForBees ? "+" + waitingForBees + ")" : ""}/${targetBeeCount}`];
      ans.push(ss);
    }

    let annexOrders = _.filter(Apiary.orders, (o) => o.hive == hive && /^annex_/.exec(o.ref))
    if (annexOrders.length) {
      let beesAmount = 0;
      let waitingForBees = 0;
      let targetBeeCount = 0;
      let operational = 0;
      let all = 0;
      _.forEach(annexOrders, (o) => {
        all += 1;
        operational += o.acted ? 1 : 0;
        if (o.master) {
          beesAmount += o.master.beesAmount;
          waitingForBees += o.master.waitingForBees;
          targetBeeCount += o.master.targetBeeCount;
        }
      });
      let ss = ["annex", ` ${operational}/${all}`, `: ${waitingForBees ? "(" : ""}${beesAmount}${
        waitingForBees ? "+" + waitingForBees + ")" : ""}/${targetBeeCount}`];
      ans.push(ss);
    }

    cell = hive.cells.upgrade;
    if (cell) {
      let ss = ["upgrade", ` ${Math.floor(cell.controller.progress / cell.controller.progressTotal * 100)}%`];
      if (cell.master)
        ss.push(`: ${cell.master.waitingForBees ? "(" : ""}${cell.master.beesAmount}${cell.master.waitingForBees ?
          "+" + cell.master.waitingForBees + ")" : ""}/${cell.master.targetBeeCount}`);
      ans.push(ss);
    }

    return ans;
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
    let textLen = label.length * TEXT_WIDTH;
    let xMax = pos.x + Math.min(Math.max(minSize, textLen + 0.5), maxSize);
    let yMax = pos.y + TEXT_HEIGHT + 0.5;
    vis.text(label, (style.align == "right" ? xMax - 0.25 : pos.x + 0.25), pos.y + 0.25 + TEXT_HEIGHT, this.textStyle(style));
    vis.poly([[pos.x, pos.y], [pos.x, yMax], [xMax, yMax], [xMax, pos.y], [pos.x, pos.y]]);
    return { x: xMax, y: yMax, roomName: pos.roomName };;
  }

  progressbar(label: string, pos: { x: number, y: number, roomName?: string }, progress: number,
    style: TextStyle = {}, minSize: number = 1, maxSize: number = 15) {
    let vis = new RoomVisual(pos.roomName);
    let lab = this.label(label, pos, style, minSize, maxSize);
    let xMin = style.align == "right" ? lab.x : pos.x;
    let xMax = xMin + (lab.x - pos.x) * Math.min(1, progress) * (style.align == "right" ? -1 : 1);
    vis.poly([[xMin, pos.y], [xMin, lab.y], [xMax, lab.y], [xMax, pos.y], [xMin, pos.y]], {
      fill: "#ffdd80",
      stroke: undefined,
      opacity: 0.3 + (progress > 1 ? Math.min((progress - 1) / 5, 0.7) : 0),
    });
    return lab;
  }

  table(strings: string[][], pos: { x: number, y: number, roomName?: string },
    style: TextStyle = {}, minSize: number = 1, maxSize: number = 20, align: "center" | "right" | "left" = "left") {
    let vis = new RoomVisual(pos.roomName);
    let pad = 0.2;

    let label;
    if (strings.length > 0 && strings[0].length == 1)
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
    if (align == "center")
      xMin = pos.x - len / 2;
    if (align == "right")
      xMin = pos.x - len;
    let xMax = xMin + len;

    let yMin = pos.y;
    let height = yMin + TEXT_HEIGHT + pad + (label ? TEXT_HEIGHT + pad : 0);
    _.forEach(strings, (s) => {
      let tab = pad;
      for (const i in s) {
        vis.text(s[i], xMin + tab, height, this.textStyle(style));
        tab += widths[i];
      }
      height += TEXT_HEIGHT * 1.2;
    });
    let yMax = height - TEXT_HEIGHT + pad;
    if (label) {
      let labelStyle = this.textStyle(style);
      labelStyle.align = "center";
      vis.text(label, xMin + (xMax - xMin) / 2, yMin + TEXT_HEIGHT, labelStyle);
      vis.poly([[xMin, yMin], [xMin, yMin + TEXT_HEIGHT + pad], [xMax, yMin + TEXT_HEIGHT + pad], [xMax, yMin], [xMin, yMin]], {
        fill: "#ffdd80",
        stroke: undefined,
        opacity: 0.3,
      });
    }
    vis.poly([[xMin, yMin], [xMin, yMax], [xMax, yMax], [xMax, yMin], [xMin, yMin]]);
    return { x: xMax, y: yMax, roomName: pos.roomName };
  }
}
