import { prefix } from "static/enums";
import { makeId } from "static/utils";

import { consoleGlobalSettings, consoleHiveSettings } from "./console-switcher";
import { snapOldPlans } from "./console-utils";

export class CustomConsole {
  // #region Properties (5)

  public clearCrashes = () => this.cleanCrashes();
  public lastActionRoomName: string;
  public removeCrashes = () => this.cleanCrashes();
  public reportCrashes = () => this.printCrashes();
  public snapOldPlans = snapOldPlans;

  // #endregion Properties (5)

  // #region Constructors (1)

  public constructor() {
    this.lastActionRoomName = _.map(Apiary.hives, (h) => h).reduce(
      (prev, curr) =>
        prev.room.controller!.level < curr.room.controller!.level ? curr : prev
    ).roomName;
  }

  public mode = consoleHiveSettings;
  public settings = consoleGlobalSettings;

  // #endregion Constructors (1)

  // #region Public Methods (22)

  public addPowerManager(hiveName: string) {
    if (Game.gpl.level) hiveName = this.format(hiveName);
    const hive = Apiary.hives[hiveName];
    if (!hive) return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
    this.lastActionRoomName = hive.roomName;
    if (!hive.cells.power)
      return `ERROR: NO POWER CELL @ ${this.formatRoom(hiveName)}`;
    _.filter(Game.powerCreeps, (c) => c.memory.born);
    const name = prefix.nkvd + " " + makeId(4);
    const ans = PowerCreep.create(name, "operator");
    if (ans !== OK) return `ERROR: ${ans}`;
    hive.cells.power.powerManager = name;
    return `OK: ${name} @ ${this.formatRoom(hiveName)}`;
  }

  /* public addStructureToPlan(
    roomName: string = this.lastActionRoomName,
    cache: RoomSetup
  ) {
    if (!(roomName in Game.rooms))
      return `CANNOT ACCESS ${this.formatRoom(roomName)}`;
    if (!Memory.cache.roomPlanner[roomName])
      return `NO PREVIOUS CACHE FOUND @ ${this.formatRoom(roomName)}`;
    if (!(roomName in Apiary.planner.activePlanning))
      return `ACTIVATE ACTIVE PLANNING FIRST @ ${this.formatRoom(roomName)}`;

    for (const t in cache) {
      let val: BuildableStructureConstant | null =
        t as BuildableStructureConstant;
      if (!(t in CONSTRUCTION_COST))
        if (t === "null") val = null;
        else continue;
      for (const posBuilding of cache[t as BuildableStructureConstant]!.pos) {
        Apiary.planner.addToPlan(posBuilding, roomName, val, true);
      }
    }
    const contr =
      Game.rooms[roomName].controller && Game.rooms[roomName].controller!.pos;
    const pos =
      contr &&
      [
        new RoomPosition(contr.x, contr.y + 1, roomName),
        new RoomPosition(contr.x, contr.y - 1, roomName),
      ].filter((p) => p.lookFor(LOOK_FLAGS).length === 0)[0];
    if (pos)
      pos.createFlag(
        "change_" + roomName + "_" + makeId(4),
        COLOR_WHITE,
        COLOR_ORANGE
      );
    else return `ERROR: TOO MUCH FLAGS @ ${this.formatRoom(roomName)}`;

    return "OK";
  } */

  /** cleans rashes report log */
  public cleanCrashes() {
    Memory.report.crashes = {};
  }

  public format(s: string) {
    if (/\d/.exec(s) !== null) return s.toUpperCase();
    else return s.toLowerCase();
  }

  public formatRoom(roomName: string, text: string = roomName) {
    return `<a href=#!/room/${Game.shard.name}/${roomName}>${text}</a>`;
  }

  public h(hiveName: string = this.lastActionRoomName) {
    hiveName = this.format(hiveName);
    const hive = Apiary.hives[hiveName];
    if (!hive) return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
    this.lastActionRoomName = hive.roomName;
    return `active hive is ${this.lastActionRoomName}`;
  }

  public miningDist(value: number) {
    Memory.settings.miningDist = value;
    _.forEach(Apiary.hives, (h) => {
      if (h.cells.observe) h.cells.observe.updateRoomsToCheck();
    });
  }

  /** markes all dropped resources in a room for pickup */
  public pickup(hiveName: string = this.lastActionRoomName) {
    hiveName = this.format(hiveName);
    const hive = Apiary.hives[hiveName];
    if (!hive) return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
    this.lastActionRoomName = hive.roomName;
    if (!hive.cells.storage)
      return `ERROR: NO STORAGE CELL @ ${this.formatRoom(hiveName)}`;
    const ans = hive.cells.storage.pickupResources();
    return `SCHEDULED ${ans} UNITS`;
  }

  public pixel(state?: boolean) {
    if (
      Memory.settings.generatePixel &&
      Game.cpu.bucket < 500 &&
      state === undefined
    )
      return `bucket is too low ${Game.cpu.bucket} wait untill it will be atleast 1000`;
    Memory.settings.generatePixel = state
      ? state
      : !Memory.settings.generatePixel;
    return `pixel generation is ${
      Memory.settings.generatePixel ? "on" : "off"
    }`;
  }

  /** nice output of last crashes */
  public printCrashes(verboseLvl = 3) {
    let reportLog = "LAST CRASHES:\n\n";
    const crashes = Object.entries(Memory.report.crashes || {});
    for (const [ref, crash] of _.sortBy(crashes, (a) => a[1].time)) {
      const stackNew = crash.stack?.split("\n").slice(1, 1 + verboseLvl) || [];

      reportLog += `${Game.time - crash.time} ticks ago : ${ref}\nMESSAGE:\n${
        crash.message
      }${crash.stack ? "\nSTACK:\n" + stackNew.join("\n") : ""}\n\n`;
    }
    return reportLog;
  }

  /** recalcs time for resources
   *
   * need to be called from time to time
   *
   * TODO automate
   */
  public recalcResTime(hiveName?: string) {
    let hives;
    if (hiveName) {
      this.lastActionRoomName = hiveName;
      hives = [Apiary.hives[hiveName]];
    } else hives = _.map(Apiary.hives, (h) => h);
    _.forEach(hives, (h) => {
      _.forEach(h.cells.excavation.resourceCells, (cell) =>
        cell.updateRoadTime(true)
      );
      h.cells.excavation.shouldRecalc = true;
    });
    return "OK";
  }

  /** removes all empty construction sites of mine
   *
   * need to be called from time to time
   *
   * TODO automate
   */
  public removeConst() {
    const saved: string[] = [];
    _.forEach(Game.constructionSites, (c) => {
      if (!c.progress) c.remove();
      else if (saved.indexOf(c.pos.roomName) === -1) saved.push(c.pos.roomName);
    });
    return (
      "non empty constructionSites in " +
      saved.map((r) => this.formatRoom(r)).join(" ")
    );
  }

  public showBreach(hiveName: string = this.lastActionRoomName, keep = false) {
    const hive = Apiary.hives[hiveName];
    if (!hive) return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
    this.lastActionRoomName = hive.roomName;
    const mask = Apiary.useBucket ? 1 : 3;
    return this.showMap(hiveName, keep, (x, y, vis) => {
      if (x % mask === 0 && y % mask === 0) {
        const pos = new RoomPosition(x, y, hiveName);
        if (
          !pos
            .lookFor(LOOK_STRUCTURES)
            .filter(
              (s) =>
                s.structureType === STRUCTURE_WALL ||
                s.structureType === STRUCTURE_RAMPART
            ).length &&
          hive.cells.defense.wasBreached(pos)
        )
          vis.circle(x, y, { radius: 0.2, fill: "#E75050" });
      }
    });
  }

  public showBuildMap(
    hiveName: string = this.lastActionRoomName,
    keep = false
  ) {
    const hive = Apiary.hives[hiveName];
    if (!hive) return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
    this.lastActionRoomName = hive.roomName;
    const targets = hive.cells.build.structuresConst;
    let ans = "";
    let rooms = targets.map((c) => c.pos.roomName);
    rooms = rooms.filter((r, i) => rooms.indexOf(r) === i);
    _.forEach(rooms, (roomName) => {
      ans +=
        this.showMap(roomName, keep, (x, y, vis) => {
          // not best way around it but i am too lazy to rewrite my old visual code for this edge usecase
          for (const t of targets) {
            if (t.pos.x === x && t.pos.y === y && t.pos.roomName === roomName) {
              vis.circle(x, y, { radius: 0.4, fill: "#70E750", opacity: 0.7 });
              break;
            }
          }
        }) + "\n";
    });
    return ans;
  }

  public showDefMap(hiveName: string = this.lastActionRoomName, keep = false) {
    const hive = Apiary.hives[hiveName];
    if (!hive) return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
    this.lastActionRoomName = hive.roomName;
    return this.showMap(hiveName, keep, (x, y, vis) => {
      const op = Math.pow(
        (hive.cells.defense.getDmgAtPos(new RoomPosition(x, y, hiveName)) /
          TOWER_POWER_ATTACK /
          Object.keys(hive.cells.defense.towers).length) *
          0.9,
        3
      );
      vis.circle(x, y, { radius: 0.2, fill: "#70E750", opacity: op });
    });
  }

  public showMap(
    roomName: string = this.lastActionRoomName,
    keep: boolean,
    visual: (x: number, y: number, vis: RoomVisual) => void,
    ignoreTerrain = false
  ) {
    const terrain = Game.map.getRoomTerrain(roomName);
    Apiary.visuals.objectsWipe(roomName);
    Apiary.visuals.objectNew({}, roomName, keep ? Infinity : 20);

    for (let x = 0; x <= 49; ++x)
      for (let y = 0; y <= 49; ++y)
        if (ignoreTerrain || terrain.get(x, y) !== TERRAIN_MASK_WALL)
          visual(x, y, Apiary.visuals.anchor.vis);

    return `OK @ ${this.formatRoom(roomName)}`;
  }

  public hideMap(roomName: string = this.lastActionRoomName) {
    Apiary.visuals.objectsWipe(roomName);
  }

  public showNukeDefMap(
    hiveName: string = this.lastActionRoomName,
    keep = false
  ) {
    const hive = Apiary.hives[hiveName];
    if (!hive) return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
    this.lastActionRoomName = hive.roomName;
    const defMap = hive.cells.defense.getNukeDefMap();
    return this.showMap(hiveName, keep, (x, y, vis) => {
      if (_.filter(defMap[0], (p) => p.pos.x === x && p.pos.y === y).length)
        vis.circle(x, y, { radius: 0.4, fill: "#70E750", opacity: 0.7 });
    });
  }

  public showSiedge(roomName: string, keep = false) {
    const siedge = Apiary.war.siedge[roomName];
    if (!siedge) return "ERROR: NO SIEDGE INFO @ " + this.formatRoom(roomName);
    const minslot = _.min(siedge.squadSlots, (s) => s.lastSpawned);
    const exits = Game.map.describeExits(roomName);
    return this.showMap(roomName, keep, (x, y, vis) => {
      if (siedge.freeTargets.filter((p) => p.x === x && p.y === y).length)
        vis.circle(x, y, { radius: 0.4, opacity: 0.3, fill: "#EBF737" });

      const breakIn = siedge.breakIn.filter((p) => p.x === x && p.y === y)[0];
      if (breakIn) {
        vis.circle(x, y, { radius: 0.4, opacity: 0.7, fill: "#1C6F21" });
        let direction: TOP | BOTTOM | RIGHT | LEFT | undefined;
        for (const ex in exits)
          if (exits[ex as ExitKey] === breakIn.ent) {
            direction = +ex as TOP | BOTTOM | RIGHT | LEFT;
            break;
          }
        let dx = 0;
        let dy = 0;
        switch (direction) {
          case TOP:
            dy = -2;
            break;
          case BOTTOM:
            dy = 2;
            break;
          case RIGHT:
            dx = 2;
            break;
          case LEFT:
            dx = -2;
            break;
        }
        vis.line(x, y, x + dx, y + dy, {
          opacity: 0.7,
          color: "#1C6F21",
          width: 0.3,
        });
        vis.text(
          breakIn.state + "",
          x - 0.2,
          y + 0.23,
          Apiary.visuals.textStyle({ color: "#FF7D54" })
        );
      }

      const slot = _.filter(
        siedge.squadSlots,
        (p) => p.breakIn.x === x && p.breakIn.y === y
      )[0];
      if (slot) {
        const txt =
          (slot.type === "dism" ? "⚒️" : "🗡️") +
          ": " +
          (slot.lastSpawned + CREEP_LIFE_TIME < Game.time
            ? "❗"
            : slot.lastSpawned + CREEP_LIFE_TIME - Game.time) +
          (slot === minslot ? " 🔥" : "");
        vis.text(txt, x - 0.15, y + 1.2, Apiary.visuals.textStyle());
      }

      /* let value = siedge.matrix[x] && siedge.matrix[x][y];
      if (value === 0xff)
        vis.circle(x, y, { radius: 0.2, opacity: 0.5, fill: "#E75050" });
      else
        vis.text("" + value, x, y + 0.15,
          Apiary.visuals.textStyle({ opacity: 1, font: 0.35, strokeWidth: 0.75, color: "#1C6F21", align: "center" })); */
    });
  }

  public showSpawnMap(
    hiveName: string = this.lastActionRoomName,
    keep = false
  ) {
    const hive = Apiary.hives[hiveName];
    if (!hive) return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
    this.lastActionRoomName = hive.roomName;

    let targets: (StructureSpawn | StructureExtension)[] = Object.values(
      hive.cells.spawn.spawns
    );
    targets = targets.concat(Object.values(hive.cells.spawn.extensions));
    targets.sort(
      (a, b) =>
        (hive.cells.spawn.priorityMap[a.id] || Infinity) -
        (hive.cells.spawn.priorityMap[b.id] || Infinity)
    );
    return this.showMap(hiveName, keep, (x, y, vis) => {
      // not best way around it but i am too lazy to rewrite my old visual code for this edge usecase
      for (let i = 0; i < targets.length; ++i) {
        const t = targets[i];
        if (t.pos.x === x && t.pos.y === y) {
          vis.text(
            "" + i,
            x,
            y + 0.15,
            Apiary.visuals.textStyle({
              opacity: 1,
              font: 0.35,
              strokeWidth: 0.75,
              color: "#1C6F21",
              align: "center",
            })
          );
          break;
        }
      }
    });
  }

  public siedge(roomName: string, attack = 0) {
    Apiary.war.updateRoom(roomName, attack ? Game.time : null);
  }

  // #endregion Public Methods (22)
}
