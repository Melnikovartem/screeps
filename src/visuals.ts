import { profile } from "./profiler/decorator";

@profile
export class Visuals {
  roomVisuals: {
    [id: string]: {
      visual: RoomVisual,
      height: number,
      width: number,
    }
  } = {};

  create() {
    this.start();
    this.statsHives();
    this.finish();
  }

  start() {

  }

  statsHives() {
    for (const name in Apiary.hives) {
      let hive = Apiary.hives[name];
      this.writeText(name, `${name}:`);
      if (hive.cells.spawn.beeMaster)
        this.writeText(name, `queens ${hive.cells.spawn.beeMaster.beesAmount}/${hive.cells.spawn.beeMaster.targetBeeCount}`);
      if (hive.cells.storage && hive.cells.storage.beeMaster)
        this.writeText(name, `haulers ${hive.cells.storage.beeMaster.beesAmount}/${hive.cells.storage.beeMaster.targetBeeCount}`);
    }
  }

  finish() {
    for (const roomName in this.roomVisuals) {
      let vis = this.roomVisuals[roomName];
      vis.width = Math.ceil(vis.width) + 1;
      vis.visual.poly([[0.8, 0], [0.8, vis.height], [vis.width, vis.height], [vis.width, 0], [0.8, 0]]);
    }
  }

  writeText(roomName: string, text: string) {
    if (!this.roomVisuals[roomName])
      this.roomVisuals[roomName] = {
        visual: new RoomVisual(roomName),
        height: 1,
        width: 0,
      };
    this.roomVisuals[roomName].visual.text(text, 1, this.roomVisuals[roomName].height, {
      color: "#e3e3de",
      font: "0.7",
      stroke: undefined,
      strokeWidth: 0.01,
      backgroundColor: undefined,
      backgroundPadding: 0.3,
      align: "left",
      opacity: 0.8,
    });
    this.roomVisuals[roomName].height += 0.7 * 0.9 * 1;
    this.roomVisuals[roomName].width = Math.max(this.roomVisuals[roomName].width, text.length * 0.7 * 0.4 * 1.2);
  }
}
