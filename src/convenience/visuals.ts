import { hiveStates, prefix } from "../enums";
import { makeId } from "../abstract/utils";

import { profile } from "../profiler/decorator";
import { AnnexMaster } from "../beeMasters/civil/annexer";
import type { PossiblePositions, Hive } from "../hive";

const TEXT_SIZE = 0.8;
const TEXT_HEIGHT = TEXT_SIZE * 0.9;
const SPACING = 0.3;

type VisInfo = { x: number, y: number, vis: RoomVisual, ref: string }

const GLOBAL_VISUALS = "global";
const GLOBAL_VISUALS_HEAVY = GLOBAL_VISUALS + "h";

@profile
export class Visuals {
  caching: { [id: string]: { data: string, lastRecalc: number } } = {
    [GLOBAL_VISUALS]: { data: "", lastRecalc: -1 },
    [GLOBAL_VISUALS_HEAVY]: { data: "", lastRecalc: -1 },
  };
  anchor: VisInfo = { x: 1, y: 1, vis: new RoomVisual(makeId(8)), ref: "" };
  usedAnchors: { [roomName: string]: VisInfo } = {}

  changeAnchor(x?: number, y?: number, roomName?: string, newAnchor = false) {
    if (x !== undefined)
      this.anchor.x = x;
    this.anchor.y = y === undefined ? this.anchor.y + SPACING : y;

    if (roomName) {
      this.usedAnchors[this.anchor.ref] = this.anchor;
      if (!newAnchor && roomName in this.usedAnchors)
        this.anchor = this.usedAnchors[roomName];
      else {
        this.anchor.vis = new RoomVisual(makeId(8));
        this.anchor.ref = roomName;
      }
    }

    return this.anchor;
  }

  updateAnchor(info: { x: number, y: number }) {
    this.anchor.y = info.y + SPACING;
  }

  exportAnchor(offset = 0, ref = this.anchor.ref) {
    this.caching[ref] = { data: this.anchor.vis.export(), lastRecalc: Game.time + offset };
  }

  update() {
    let allglobal = true;
    for (const name in this.caching)
      if (name.slice(0, GLOBAL_VISUALS.length) !== GLOBAL_VISUALS) {
        let vis = new RoomVisual(name);
        vis.import(this.caching[name].data);
        if (this.caching[name].lastRecalc > Game.time)
          allglobal = false;
      }
    if (allglobal) {
      let vis = new RoomVisual();
      vis.import(this.caching[GLOBAL_VISUALS].data);
      vis.import(this.caching[GLOBAL_VISUALS_HEAVY].data);
    } else
      for (const name in this.caching)
        if (this.caching[name].lastRecalc <= Game.time) {
          let vis = new RoomVisual(name);
          vis.import(this.caching[GLOBAL_VISUALS].data);
          vis.import(this.caching[GLOBAL_VISUALS_HEAVY].data);
        }
    this.usedAnchors = {};
  }

  run() {
    if (Memory.settings.framerate < 0)
      return;

    if (Game.time % Memory.settings.framerate === 0 || Game.time === Apiary.createTime) {
      if (Apiary.useBucket) {
        for (const name in Apiary.hives)
          this.createHive(name);

        this.changeAnchor(30, 1, GLOBAL_VISUALS_HEAVY, true);
        this.battleInfo();
        this.exportAnchor();
      }

      this.changeAnchor(49, 1, GLOBAL_VISUALS, true);
      this.global();
      this.exportAnchor();
    }
    this.visualizePlanner();

    this.update();
  }

  createHive(name: string) {
    let hive = Apiary.hives[name];
    this.changeAnchor(1, 1, name);
    this.statsHive(hive);
    this.statsNetwork(hive);
    this.statsLab(hive);
    this.statsFactory(hive);
    this.statsNukes(hive);

    _.forEach(hive.annexNames, annex => {
      if (!this.caching[annex] || Game.time > this.caching[annex].lastRecalc)
        this.exportAnchor(0, annex);
    });

    this.nukeInfo(hive);
    this.spawnInfo(hive);

    if (!this.caching[name] || Game.time > this.caching[name].lastRecalc)
      this.exportAnchor();
  }

  global() {
    const minLen = 6.2;
    if (!Apiary.useBucket)
      this.updateAnchor(this.label("LOW CPU", this.anchor, { align: "right" }, minLen));
    this.updateAnchor(this.progressbar(Math.round(Game.cpu.getUsed() * 100) / 100 + " : CPU", this.anchor, Game.cpu.getUsed() / Game.cpu.limit, { align: "right" }, minLen));
    this.updateAnchor(this.progressbar(Math.round(Game.cpu.bucket) + " : BUCKET", this.anchor, Game.cpu.bucket / 10000, { align: "right" }, minLen)); // PIXEL_CPU_COST but not everywhere exists
    this.updateAnchor(this.progressbar(Game.gcl.level + "→" + (Game.gcl.level + 1) + " : GCL", this.anchor, Game.gcl.progress / Game.gcl.progressTotal, { align: "right" }, minLen));
    let heapStat = Game.cpu.getHeapStatistics && Game.cpu.getHeapStatistics();
    if (heapStat)
      this.updateAnchor(this.progressbar("HEAP", this.anchor, heapStat.used_heap_size / heapStat.total_available_size, { align: "right" }, minLen));
  }

  battleInfo() {
    let battleInfo: string[][] = [["bee squads"], ["", "🎯", "☠️❗", "💀", "🐝"]];
    for (const name in Apiary.hives) {
      let stats = this.statsOrders(name);
      if (stats.length > 0) {
        for (let i in stats)
          for (let j in stats[i])
            stats[i][j] = stats[i][j].slice(0, 11);
        battleInfo.push(["", name]);
        battleInfo = battleInfo.concat(stats);
      }
    }
    this.updateAnchor(this.table(battleInfo, this.anchor, undefined, undefined, undefined, "center"));
  }

  visualizePlanner() {
    for (const roomName in Apiary.planner.activePlanning) {
      if (this.caching[roomName] && this.caching[roomName].lastRecalc > Game.time)
        continue;
      this.changeAnchor(0, 0, roomName, true);
      let vis = this.anchor.vis;
      let hive = Apiary.hives[roomName];
      if (hive) {
        this.nukeInfo(hive);
        _.forEach(hive.cells.defense.getNukeDefMap(), (p) => {
          vis.circle(p.pos.x, p.pos.y, { opacity: 0.3, fill: "#A1FF80", radius: 0.5, });
        });
      }

      for (let x in Apiary.planner.activePlanning[roomName].plan)
        for (let y in Apiary.planner.activePlanning[roomName].plan[+x]) {
          let style: CircleStyle = {
            opacity: 0.6,
            radius: 0.35
          };
          switch (Apiary.planner.activePlanning[roomName].plan[+x][+y].s) {
            case STRUCTURE_ROAD:
              style.fill = "#B0B0B0";
              style.radius = 0.2;
              break;
            case STRUCTURE_WALL:
              style.fill = "#333433";
              style.opacity = 1;
              break;
            case STRUCTURE_EXTENSION:
              style.fill = "#ffdd80";
              break;
            case STRUCTURE_LAB:
              style.fill = "#91EFD8";
              break;
            case STRUCTURE_LINK:
              style.fill = "#8B59EF";
              break;
            case STRUCTURE_STORAGE: case STRUCTURE_TERMINAL:
              style.fill = "#FBA31C";
              style.opacity = 0.8;
              break;
            case STRUCTURE_FACTORY:
              style.fill = "#D88E54"
              break;
            case STRUCTURE_POWER_SPAWN:
              style.fill = "#9E2413";
              break;
            case STRUCTURE_TOWER:
              style.fill = "#F988AE";
              style.opacity = 0.8;
              style.radius = 0.3;
              break;
            case STRUCTURE_SPAWN:
              style.fill = "#9E1393";
              style.opacity = 1;
              break;
            case null:
              style.fill = "#1C1C1C";
              style.opacity = 0.4;
              style.radius = 0.1;
              break;
            case undefined:
              style.opacity = 0;
              break;
            default:
              style.fill = "#1823FF";
              break;
          }
          vis.circle(+x, +y, style);
          if (Apiary.planner.activePlanning[roomName].plan[+x][+y].r)
            vis.circle(+x, +y, { opacity: 0.3, fill: "#A1FF80", radius: 0.5, });
        }

      for (let t in Apiary.planner.activePlanning[roomName].poss) {
        let type = <keyof PossiblePositions>t
        let pos = Apiary.planner.activePlanning[roomName].poss[type]!;
        let style: LineStyle = {
          opacity: 0.8,
        };
        switch (type) {
          case "lab":
            style.color = "#91EFD8";
            break;
          case "rest":
            style.color = "#000000";
            break;
          case "center":
            style.color = "#ffdd80";
            break;
          case "queen1":
            style.color = "#CAFABE";
            break;
          case "queen2":
            style.color = "#FAE4BE";
            break;
        };
        const SIZE = 0.3;
        vis.line(pos.x - SIZE, pos.y - SIZE, pos.x + SIZE, pos.y + SIZE, style);
        vis.line(pos.x + SIZE, pos.y - SIZE, pos.x - SIZE, pos.y + SIZE, style);
      }
      this.exportAnchor();
    }
  }

  visualizeEnergy(hiveName: string, align: "center" | "right" | "left" = "left", snap: "bottom" | "top" = "top") {
    if (!Apiary.logger)
      return;
    let report = Apiary.logger.reportEnergy(hiveName);
    let ans: string[][] = [["energy"], ["", "⚡", "💸"]];
    let overAll = 0;
    let prep = (rate: number): string => String(Math.round(rate * 100) / 100);

    ans.push(["  📈income"]);
    for (let ref in report)
      if (Math.round(report[ref].profit * 100) > 0) {
        overAll += report[ref].profit;
        ans.push([ref, report[ref].revenue !== undefined ? prep(report[ref].revenue!) : "", prep(report[ref].profit)]);
      }


    ans.push(["  📉expenditure"]);
    for (let ref in report)
      if (Math.round(report[ref].profit * 100) < 0) {
        overAll += report[ref].profit;
        ans.push([ref, report[ref].revenue !== undefined ? prep(report[ref].revenue!) : "", prep(report[ref].profit)]);
      }

    ans.splice(2, 0, ["  💎🙌", "", prep(overAll)]);

    this.anchor.y = this.table(ans, this.anchor,
      undefined, undefined, undefined, align, snap).y;
    return;
  }

  statsOrders(hiveName: string): string[][] {
    let orders = _.filter(Apiary.orders, o => o.hive.roomName === hiveName && !(o.flag.color === COLOR_PURPLE && o.ref.includes(prefix.annex)) && o.master);
    let length = orders.length;
    const MAX_STATS = 10;
    let ans: string[][] = [];
    if (orders.length > MAX_STATS)
      orders = orders.filter(o => !o.ref.includes(prefix.annex) && !o.ref.includes(prefix.puppet));
    if (orders.length > MAX_STATS)
      orders = orders.filter(o => !o.ref.includes(prefix.def));
    if (orders.length > MAX_STATS)
      orders = orders.filter(o => Apiary.intel.getInfo(o.pos.roomName, 25).dangerlvlmax > 0);
    if (orders.length > MAX_STATS)
      orders = orders.filter(o => o.master!.activeBees.length || o.master!.waitingForBees);
    if (orders.length > MAX_STATS)
      orders = orders.slice(0, MAX_STATS);
    _.forEach(orders, order => {
      let roomInfo = Apiary.intel.getInfo(order.pos.roomName);
      let info = [order.ref, " " + order.pos.roomName, " " + roomInfo.dangerlvlmax, " " + roomInfo.enemies.length];
      if (order.master) {
        info.push(`: ${order.master.waitingForBees ? "(" : ""}${order.master.beesAmount}${order.master.waitingForBees ?
          "+" + order.master.waitingForBees + ")" : ""}/${order.master.targetBeeCount}`)
      }
      ans.push(info);
    });
    if (length !== orders.length)
      ans.push(["+ " + (length - orders.length)])
    return ans;
  }

  statsHive(hive: Hive) {
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
    let ans: string[][] = [["hive " + hive.roomName + hiveState], ["", "❓", "🐝"]];
    let cell;
    cell = hive.cells.spawn;
    if (cell) {
      if (hive.bassboost)
        ans.push(["spawn", "→" + hive.bassboost.roomName, ":"]);
      else
        ans.push(["spawn",
          !Object.keys(hive.spawOrders).length ? "" : ` ${Object.keys(hive.spawOrders).length}`,
          this.getBeesAmount(cell.master)]);
    }
    cell = hive.cells.storage;
    if (cell)
      ans.push(["storage",
        !Object.keys(cell.requests).length ? "" : ` ${_.filter(cell.requests, r => r.priority).length}/${Object.keys(cell.requests).length}`,
        this.getBeesAmount(cell.master)]);
    cell = hive.cells.dev;
    if (cell)
      ans.push(["develop", "", this.getBeesAmount(cell.master)]);
    if (hive.phase > 0) {
      cell = hive.cells.excavation;
      ans.push(["excav", !cell.quitefullCells.length ? "" :
        ` ${cell.quitefullCells.length}/${_.filter(cell.resourceCells, c => c.operational && !c.link).length}`,
        this.getBeesAmount(cell.master)]);
    }

    let stats = { waitingForBees: 0, beesAmount: 0, targetBeeCount: 0 };
    let operational = 0;
    let all = 0;
    _.forEach(hive.cells.excavation.resourceCells, rcell => {
      ++all;
      operational += rcell.operational ? 1 : 0;
      if (rcell.master && (rcell.operational || rcell.master.beesAmount || rcell.master.waitingForBees)) {
        stats.beesAmount += rcell.master.beesAmount;
        stats.waitingForBees += rcell.master.waitingForBees;
        stats.targetBeeCount += rcell.master.targetBeeCount;
      }
    });
    ans.push(["resource", operational === all ? "" : ` ${operational}/${all}`, this.getBeesAmount(stats)]);

    let annexOrders = _.filter(Apiary.orders, o => o.hive === hive && o.flag.color === COLOR_PURPLE && o.flag.secondaryColor === COLOR_PURPLE);
    if (annexOrders.length) {
      let stats = { waitingForBees: 0, beesAmount: 0, targetBeeCount: 0 };
      let statsPuppet = { waitingForBees: 0, beesAmount: 0, targetBeeCount: 0 };
      let operational = 0;
      let all = 0;
      _.forEach(annexOrders, o => {
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
      ans.push(["annex", operational === all ? "" : ` ${operational}/${all}`, this.getBeesAmount(stats)]);
      if (statsPuppet.targetBeeCount > 0) ans.push(["pups", "", this.getBeesAmount(statsPuppet)]);
    }

    if (hive.sumCost || (hive.builder && hive.builder.beesAmount)) {
      ans.push(["build", !hive.sumCost ? "" : ` ${hive.sumCost >= 5000 ? Math.round(hive.sumCost / 1000)
        : Math.round(hive.sumCost / 1000 * 10) / 10}K/${hive.structuresConst.length}`, this.getBeesAmount(hive.builder)]);
    }

    ans.push(["upgrade",
      ` ${!hive.controller.progressTotal ? "" : Math.floor(hive.controller.progress / hive.controller.progressTotal * 100) + "%"}`,
      this.getBeesAmount(hive.cells.upgrade && hive.cells.upgrade.master)]);

    if (hive.state === hiveStates.battle || hive.cells.defense.master.beesAmount || hive.cells.defense.master.waitingForBees)
      ans.push(["defense",
        ` ${Apiary.intel.getInfo(hive.roomName).dangerlvlmax}`,
        this.getBeesAmount(hive.cells.defense.master)]);

    let minSize = 0;
    let table = this.table(ans, this.anchor, undefined, minSize);
    this.changeAnchor(table.x, table.y);
    minSize = Math.max(minSize, this.anchor.x - 1);
  }

  statsNetwork(hive: Hive) {
    let negative: string[][] = [["deficiency"], ["💱", "📉"]];

    for (const res in hive.resState) {
      let amount = hive.resState[<ResourceConstant>res];
      if (amount && amount < 0) {
        let str = " " + -amount;
        if (amount < -1000)
          str = " " + -Math.round(amount / 100) / 10 + "K"
        negative.push([res, str]);
      }
    }
    let [x, y] = [this.anchor.x, this.anchor.y];
    let y_new = this.anchor.y;
    if (negative.length > 2) {
      this.changeAnchor(x + SPACING, 1);
      y_new = this.table(negative, this.anchor, undefined).y;
    }
    this.changeAnchor(1, Math.max(y, y_new) + SPACING);

    let aid = Apiary.network.aid[hive.roomName];
    if (aid)
      this.updateAnchor(this.label(`💸 ${aid.to} -> ${aid.res} ${aid.amount}`, this.anchor));
  }

  statsLab(hive: Hive) {
    if (!hive.cells.lab)
      return;
    let lab = hive.cells.lab;
    if (lab.synthesizeTarget)
      this.updateAnchor(this.label(`🧪 ${lab.prod ? lab.prod.res + " " + lab.prod.plan : "??"} -> ${lab.synthesizeTarget.res} ${lab.synthesizeTarget.amount}`, this.anchor));

    if (Object.keys(hive.cells.lab.boostRequests).length) {
      let ans = [["🐝", "", "🧬", " 🧪", "🥼"]];
      for (const refBee in lab.boostRequests) {
        let splitName = refBee.split(" ");
        splitName.pop();
        let name = splitName.join(" "); // .map(s => s.slice(0, 5) + (s.length > 5 ? "." : ""))
        for (let i = 0; i < lab.boostRequests[refBee].info.length; ++i) {
          let r = lab.boostRequests[refBee].info[i];
          let l = lab.boostLabs[r.res];
          ans.push([!i ? name : "-", r.type, r.res, "  " + r.amount, l ? l.slice(l.length - 4) : "not found"]);
        }
      }

      this.updateAnchor(this.table(ans, this.anchor, undefined));
    }
  }

  statsFactory(hive: Hive) {
    if (!hive.cells.factory)
      return;
    let fac = hive.cells.factory;
    if (fac.commodityTarget)
      this.updateAnchor(this.label(`⚒️ ${fac.prod ? fac.prod.res + " " + fac.prod.amount : "??"} -> ${fac.commodityTarget.res} ${fac.commodityTarget.amount}`, this.anchor));
  }

  statsNukes(hive: Hive) {
    _.forEach(hive.cells.defense.nukes, nuke => {
      let percent = 1 - nuke.timeToLand / NUKE_LAND_TIME;
      this.updateAnchor(this.progressbar(`☢ ${nuke.launchRoomName} ${nuke.timeToLand} : ${Math.round(percent * 1000) / 10}%`, this.anchor, percent));
    });
  }

  nukeInfo(hive: Hive) {
    _.forEach(hive.cells.defense.nukes, nuke => {
      let n = nuke.pos;
      let xMin = n.x - 2.5;
      let xMax = n.x + 2.5;
      let yMin = n.y - 2.5;
      let yMax = n.y + 2.5;
      this.anchor.vis.poly([[xMin, yMin], [xMin, yMax], [xMax, yMax], [xMax, yMin], [xMin, yMin]], { stroke: "#F1AFA1" });
      this.anchor.vis.circle(n.x, n.y, { fill: "#000000" });
    });
  }

  spawnInfo(hive: Hive) {
    let usedY: number[] = [];
    _.forEach(hive.cells.spawn.spawns, s => {
      if (s.spawning) {
        let x = s.pos.x + 0.8;
        let y = s.pos.y + 0.25;
        if (usedY.indexOf(Math.round(y)) !== -1) {
          y = s.pos.y + 1.7;
          x = s.pos.x - 0.55;
          if (usedY.indexOf(Math.round(y)) !== -1)
            y = s.pos.y - 1.7;
        }
        usedY.push(Math.round(y));
        this.anchor.vis.text(`⚒️ ${s.spawning.name.slice(0, s.spawning.name.length - 5)} ${
          Math.round((1 - s.spawning.remainingTime / s.spawning.needTime) * 100)}%`, x, y, this.textStyle({ stroke: "#2E2E2E", strokeWidth: 0.1, opacity: 0.75 }));
      }
    });
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


  getTextLength(str: string) {
    let coefsum = 0;
    for (let i = 0; i < str.length; ++i) {
      let coef = 0.5;
      let code = str.charCodeAt(i);

      if (code == 0x2F || code === 0x3A)
        coef = 0.3;
      else if (0x41 <= code && code <= 0x5A)
        coef = 0.55;
      else if (code > 0x7F)
        coef = 0.8;

      coefsum += coef;
    }
    return TEXT_SIZE * coefsum;
  }

  label(label: string, info: VisInfo, style: TextStyle = {}, minSize: number = 1, maxSize: number = 15) {
    let textLen = this.getTextLength(label);
    let xMax = info.x + Math.min(Math.max(minSize, textLen + 0.5), maxSize) * (style.align === "right" ? -1 : 1);
    let yMax = info.y + TEXT_HEIGHT + 0.5;
    info.vis.text(label, info.x + 0.25 * (style.align === "right" ? -1 : 1), yMax - 0.26, this.textStyle(style));
    info.vis.poly([[info.x, info.y], [info.x, yMax], [xMax, yMax], [xMax, info.y], [info.x, info.y]]);
    return { x: xMax, y: yMax };;
  }

  progressbar(label: string, info: VisInfo, progress: number, style: TextStyle = {}, minSize: number = 1, maxSize: number = 15) {
    let lab = this.label(label, info, style, minSize, maxSize);
    let xMin = style.align === "right" ? lab.x : info.x;
    let xMax = xMin + (lab.x - info.x) * Math.min(1, progress) * (style.align === "right" ? -1 : 1);
    info.vis.poly([[xMin, info.y], [xMin, lab.y], [xMax, lab.y], [xMax, info.y], [xMin, info.y]], {
      fill: "#ffdd80",
      stroke: undefined,
      opacity: progress >= 1 ? 0.5 : 0.3,
    });
    return lab;
  }

  table(strings: string[][], info: VisInfo, style: TextStyle = {}, minSize: number = 1, maxSize: number = Infinity,
    align: "center" | "right" | "left" = "left", snap: "bottom" | "top" = "top") {
    let pad = 0.2;

    let label;
    if (strings.length > 0 && strings[0].length === 1)
      label = strings.shift()![0];

    let widths: number[] = [];
    _.forEach(strings, s => {
      for (let i = 0; i < s.length; ++i) {
        if (!widths[i])
          widths[i] = 0;
        widths[i] = Math.max(widths[i], this.getTextLength(s[i]) + (s.length === i + 1 ? 0.05 : 0.2));
      }
    });

    let xMin = info.x;
    let len = Math.min(Math.max(_.sum(widths) + pad * widths.length + pad, minSize), maxSize);
    if (align === "center")
      xMin = info.x - len / 2;
    if (align === "right")
      xMin = info.x - len;
    let xMax = xMin + len;

    let yMin = info.y;
    let height = snap === "bottom" ? -pad * 2 : pad + TEXT_HEIGHT + (label ? TEXT_HEIGHT + pad * 2 : 0);
    if (snap === "bottom")
      strings.reverse();

    _.forEach(strings, s => {
      let tab = pad * 2;
      for (const i in s) {
        info.vis.text(s[i], xMin + tab, yMin + height, this.textStyle(style));
        tab += widths[i];
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
      info.vis.text(label, xMin + (xMax - xMin) / 2, yLabel - pad, labelStyle);
      info.vis.poly([[xMin, yLabel], [xMin, yLabel - TEXT_HEIGHT - pad * 2], [xMax, yLabel - TEXT_HEIGHT - pad * 2], [xMax, yLabel]], {
        fill: "#ffdd80",
        stroke: undefined,
        opacity: 0.3,
      });
    }
    info.vis.poly([[xMin, yMin], [xMin, yMax], [xMax, yMax], [xMax, yMin], [xMin, yMin]]);
    return { x: align === "right" ? info.x : xMax, y: yMax };
  }
}
