import { profile } from "./profiler/decorator";

const TEXT_SIZE = 0.8;
const TEXT_WIDTH = TEXT_SIZE * 0.5;
const TEXT_HEIGHT = TEXT_SIZE * 0.9;

@profile
export class Visuals {

  create() {
    for (const name in Apiary.hives) {
      let pos = new RoomPosition(1, 1, name);
      pos = this.table(this.statsHives(name), pos);
      pos.x = 1;
      pos.y += 0.2;

      let labReuest = Apiary.hives[name].cells.lab && Apiary.hives[name].cells.lab!.currentRequest
      if (labReuest) {
        pos = this.progressbar(` ${labReuest.res1} + ${labReuest.res2} => ${labReuest.res} ${labReuest.current}/${labReuest.plan}`, pos, 0);
        pos.x = 1;
        pos.y += 0.2;
      }
    }
  }

  statsHives(hiveName: string): string[][] {
    let ans: string[][] = [[hiveName]];
    let hive = Apiary.hives[hiveName];
    let cell;
    cell = hive.cells.spawn;
    if (cell) {
      let ss = ["spawn"];
      ss.push(hive.orderList.length ? ` ${hive.orderList.length}` : "");
      if (cell.beeMaster)
        ss.push(` : ${cell.beeMaster.waitingForBees ? "(" : ""}${cell.beeMaster.beesAmount}${cell.beeMaster.waitingForBees ?
          "+" + cell.beeMaster.waitingForBees + ")" : ""}/${cell.beeMaster.targetBeeCount}`);
      ans.push(ss);
    }
    cell = hive.cells.storage;
    if (cell) {
      let ss = ["storage"];
      ss.push(cell.requests.length ? ` ${Object.keys(cell.requests).length}` : "");
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
      let ss = ["exacv"];
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
        if (rcell.beeMaster) {
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

  progressbar(label: string, pos: RoomPosition, progress: number) {
    let vis = new RoomVisual(pos.roomName);
    let xMax = pos.x + label.length * TEXT_WIDTH + 0.4;
    let yMax = pos.y + TEXT_HEIGHT + 0.5;
    vis.text(label, pos.x + 0.25, pos.y + 0.2 + TEXT_HEIGHT, this.textStyle());
    vis.poly([[pos.x, pos.y], [pos.x, yMax], [xMax, yMax], [xMax, pos.y], [pos.x, pos.y]]);
    return new RoomPosition(Math.ceil(xMax), Math.ceil(yMax), pos.roomName);
  }

  table(strings: string[][], pos: RoomPosition) {
    let vis = new RoomVisual(pos.roomName);
    let pad = 0.2;
    let widths: number[] = [];
    _.forEach(strings, (s) => {
      for (let i = 0; i < s.length; ++i) {
        if (!widths[i])
          widths[i] = 0;
        widths[i] = Math.max(widths[i], s[i].length * TEXT_WIDTH + 0.4);
      }
    });
    let height = pos.y + pad + TEXT_HEIGHT;
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
    vis.poly([[pos.x, pos.y], [pos.x, yMax], [xMax, yMax], [xMax, pos.y], [pos.x, pos.y]]);
    return new RoomPosition(Math.ceil(xMax), Math.ceil(yMax), pos.roomName);
  }
}
