import { profile } from "./profiler/decorator";

const TEXT_SIZE = 0.8;
const TEXT_WIDTH = TEXT_SIZE * 0.5;
const TEXT_HEIGHT = TEXT_SIZE * 0.9;

@profile
export class Visuals {

  caching: { [id: string]: string } | null = null;

  create() {
    if (Game.time % 10 == 0 || !this.caching) {
      if (!this.caching)
        this.caching = {};
      for (const name in Apiary.hives) {
        let pos = new RoomPosition(1, 1, name);
        let ans = this.table(this.statsHives(name), pos);
        pos.y = Math.ceil(ans.y) + 0.2;

        let labReuest = Apiary.hives[name].cells.lab && Apiary.hives[name].cells.lab!.currentRequest
        if (labReuest && labReuest.plan) {
          ans = this.progressbar(` ${labReuest.res1} + ${labReuest.res2} => ${labReuest.res} ${labReuest.plan}`,
            pos, (1 - (labReuest.current / labReuest.plan)));
          pos.y = Math.ceil(ans.y) + 0.2;
        }
        this.caching[name] = new RoomVisual(name).export();
        _.forEach(Apiary.hives[name].annexNames, (annex) => {
          new RoomVisual(annex).import(this.caching![name]);
          this.caching![annex] = this.caching![name];
        });
      }
    } else
      for (const name in this.caching)
        new RoomVisual(name).import(this.caching[name]);
  }

  statsHives(hiveName: string): string[][] {
    let hive = Apiary.hives[hiveName];
    let ans: string[][] = [[hiveName]];
    let cell;
    cell = hive.cells.spawn;
    if (cell) {
      let ss = ["spawn"];
      if (hive.bassboost)
        ss.push(hive.bassboost.roomName);
      else {
        ss.push(hive.orderList.length ? ` ${hive.orderList.length}` : "");
        if (cell.beeMaster)
          ss.push(` : ${cell.beeMaster.waitingForBees ? "(" : ""}${cell.beeMaster.beesAmount}${cell.beeMaster.waitingForBees ?
            "+" + cell.beeMaster.waitingForBees + ")" : ""}/${cell.beeMaster.targetBeeCount}`);
      }
      ans.push(ss);
    }
    cell = hive.cells.storage;
    if (cell) {
      let ss = ["storage"];
      ss.push(Object.keys(cell.requests).length ? ` ${Object.keys(cell.requests).length}` : "");
      if (cell.beeMaster)
        ss.push(` : ${cell.beeMaster.waitingForBees ? "(" : ""}${cell.beeMaster.beesAmount}${cell.beeMaster.waitingForBees ?
          "+" + cell.beeMaster.waitingForBees + ")" : ""}/${cell.beeMaster.targetBeeCount}`);
      ans.push(ss);
    }
    cell = hive.cells.dev;
    if (cell) {
      let ss = ["develop"];
      ss.push(cell.sources.length ? ` ${Object.keys(cell.sources).length}` : "");
      if (cell.beeMaster)
        ss.push(` : ${cell.beeMaster.waitingForBees ? "(" : ""}${cell.beeMaster.beesAmount}${cell.beeMaster.waitingForBees ?
          "+" + cell.beeMaster.waitingForBees + ")" : ""}/${cell.beeMaster.targetBeeCount}`);
      ans.push(ss);
    }
    cell = hive.cells.excavation;
    if (cell) {
      let ss = ["exacav"];
      ss.push(` ${cell.quitefullContainers.length}/${_.sum(cell.resourceCells, (c) => c.container && c.operational && !c.link ? 1 : 0)}`)
      if (cell.beeMaster)
        ss.push(` : ${cell.beeMaster.waitingForBees ? "(" : ""}${cell.beeMaster.beesAmount}${cell.beeMaster.waitingForBees ?
          "+" + cell.beeMaster.waitingForBees + ")" : ""}/${cell.beeMaster.targetBeeCount}`);
      ans.push(ss);

      let beesAmount = 0;
      let waitingForBees = 0;
      let targetBeeCount = 0;
      let operational = 0;
      let all = 0
      _.forEach(cell.resourceCells, (rcell) => {
        all += 1;
        operational += rcell.operational ? 1 : 0;
        if (rcell.beeMaster && rcell.perSecondNeeded) {
          beesAmount += rcell.beeMaster.beesAmount;
          waitingForBees += rcell.beeMaster.waitingForBees;
          targetBeeCount += rcell.beeMaster.targetBeeCount;
        }
      });
      ss = ["resource", ` ${operational}/${all}`, ` : ${waitingForBees ? "(" : ""}${beesAmount}${waitingForBees ? "+" + waitingForBees + ")" : ""}/${targetBeeCount
        }`];
      ans.push(ss);
    }

    return ans;
  }

  textStyle(style: TextStyle = {}) {
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

  label(label: string, pos: { x: number, y: number, roomName: string }): { x: number, y: number } {
    let vis = new RoomVisual(pos.roomName);
    let xMax = pos.x + label.length * TEXT_WIDTH + 0.4;
    let yMax = pos.y + TEXT_HEIGHT + 0.5;
    vis.text(label, pos.x + 0.25, pos.y + 0.15 + TEXT_HEIGHT, this.textStyle());
    vis.poly([[pos.x, pos.y], [pos.x, yMax], [xMax, yMax], [xMax, pos.y], [pos.x, pos.y]]);
    return { x: xMax, y: yMax };
  }

  progressbar(label: string, pos: { x: number, y: number, roomName: string }, progress: number = 1): { x: number, y: number } {
    let vis = new RoomVisual(pos.roomName);
    let lab = this.label(label, pos);
    let xMax = (pos.x - lab.x) * progress + pos.x
    vis.poly([[pos.x, pos.y], [pos.x, lab.y], [xMax, lab.y], [xMax, pos.y], [pos.x, pos.y]], {
      fill: "#ffdd80",
      stroke: undefined,
      opacity: 0.3,
    });
    return lab;
  }

  table(strings: string[][], pos: { x: number, y: number, roomName: string }): { x: number, y: number } {
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
        widths[i] = Math.max(widths[i], s[i].length * TEXT_WIDTH + 0.4);
      }
    });
    let height = pos.y + TEXT_HEIGHT + pad + (label ? TEXT_HEIGHT + pad : 0);
    _.forEach(strings, (s) => {
      let tab = pad;
      for (const i in s) {
        vis.text(s[i], pos.x + tab, height, this.textStyle());
        tab += widths[i];
      }
      height += TEXT_HEIGHT * 1.2;
    });
    let xMax = pos.x + _.sum(widths) + pad * 2;
    let yMax = height - TEXT_HEIGHT + pad;
    if (label) {
      vis.text(label, pos.x + (xMax - pos.x) / 2, pos.y + TEXT_HEIGHT, this.textStyle({ align: "center" }));
      vis.poly([[pos.x, pos.y], [pos.x, pos.y + TEXT_HEIGHT + pad], [xMax, pos.y + TEXT_HEIGHT + pad], [xMax, pos.y], [pos.x, pos.y]], {
        fill: "#ffdd80",
        stroke: undefined,
        opacity: 0.3,
      });
    }
    vis.poly([[pos.x, pos.y], [pos.x, yMax], [xMax, yMax], [xMax, pos.y], [pos.x, pos.y]]);
    return { x: xMax, y: yMax };
  }
}
