import type { HiveCache } from "../../abstract/hiveMemory";
import { BASE_MODE_HIVE } from "../../abstract/hiveMemory";
import type { RoomSetup } from "../../abstract/roomPlanner";
import { makeId } from "../../abstract/utils";
import { REACTION_MAP } from "../../cells/stage1/laboratoryCell";
import { TERMINAL_ENERGY } from "../../cells/stage1/storageCell";
import { prefix, roomStates } from "../../enums";

export class CustomConsole {
  public lastActionRoomName: string;

  public constructor() {
    this.lastActionRoomName = _.map(Apiary.hives, (h) => h).reduce(
      (prev, curr) =>
        prev.room.controller!.level < curr.room.controller!.level ? curr : prev
    ).roomName;
  }

  public vis(framerate?: number, force: number = 0) {
    for (const name in Apiary.visuals.caching) {
      if (
        framerate === undefined &&
        Apiary.visuals.caching[name].lastRecalc - Game.time > 5
      )
        framerate = Memory.settings.framerate; // updating some sticky state
      Apiary.visuals.caching[name].lastRecalc = Game.time;
    }

    Memory.settings.framerate =
      framerate !== undefined
        ? framerate
        : Memory.settings.framerate !== 1
        ? 1
        : 0;
    Memory.settings.forceBucket = force;

    return `framerate: ${Memory.settings.framerate}${
      Memory.settings.forceBucket ? ", ignoring bucket" : ""
    }`;
  }

  public reportCPU(state?: boolean) {
    if (state === undefined || state == null) {
      state = !Memory.settings.reportCPU;
    }
    Memory.settings.reportCPU = state;
    return `CPU logging is ${Memory.settings.reportCPU ? "on" : "off"}`;
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

  public siedge(roomName: string, attack = 0) {
    Apiary.warcrimes.updateRoom(roomName, attack ? Game.time : null);
  }

  public h(hiveName: string = this.lastActionRoomName) {
    hiveName = this.format(hiveName);
    const hive = Apiary.hives[hiveName];
    if (!hive) return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
    this.lastActionRoomName = hive.roomName;
    return `active hive is ${this.lastActionRoomName}`;
  }

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

  public mode(mode = "", hiveName?: string, value?: number) {
    let ans = "";
    mode = mode.toLowerCase();

    switch (mode) {
      case "upg":
        mode = "upgrade";
        break;
      case "build":
      case "buildboost":
        mode = "buildBoost";
        break;
      case "sell":
      case "selloff":
        mode = "sellOff";
        break;
      case "buy":
      case "buyin":
        mode = "buyIn";
        break;
    }
    let on: 0 | 1;
    _.forEach(
      _.filter(Apiary.hives, (h) => !hiveName || hiveName.includes(h.roomName)),
      (h) => {
        const dd = Memory.cache.hives[h.roomName].do;
        switch (mode) {
          case "power":
            dd.powerMining =
              value === 0 || value === 1 ? value : dd.powerMining ? 0 : 1;
            if (dd.powerMining && value !== 0) dd.powerRefining = 1;
            break;
          case "powermining":
            if (value === 0 || value === 1) dd.powerMining = value;
            break;
          case "deposit":
            dd.depositMining =
              value === 0 || value === 1 ? value : dd.depositMining ? 0 : 1;
            if (dd.depositMining) dd.depositRefining = 1;
            break;
          case "depositrefining":
            if (value === 0 || value === 1) dd.depositRefining = value;
            break;
          case "upgrade":
            if (value === 3) {
              dd[mode] = value;
              break;
            }
            break;
          case "buildBoost":
            if (value === 2) {
              dd[mode] = value;
              break;
            }
            dd[mode] = value === 0 || value === 1 ? value : dd[mode] ? 0 : 1;
            break;
          case "unboost" || "saveCpu" || "war" || "sellOff" || "buyIn":
            dd[mode] = value === 0 || value === 1 ? value : dd[mode] ? 0 : 1;
            break;
          case "hib" || "hibernate":
            on =
              value === 0 || value === 1
                ? value
                : dd.unboost && dd.saveCpu
                ? 0
                : 1;
            dd.unboost = on;
            dd.saveCpu = on;
            break;
          case "def":
          case "default":
            Memory.cache.hives[h.roomName].do = { ...BASE_MODE_HIVE };
            break;
        }
        const addString = (name: keyof HiveCache["do"], ref: string = name) =>
          `${ref.toUpperCase()}${
            h.shouldDo(name) === BASE_MODE_HIVE[name] ? "" : "❗"
          }: ${
            !h.shouldDo(name)
              ? "OFF"
              : "ON" + (h.shouldDo(name) !== 1 ? " " + h.shouldDo(name) : "")
          } `;
        let buyInMode = addString("buyIn").slice(0, -3);
        switch (h.shouldDo("buyIn")) {
          case 3:
            buyInMode += "ANYTHING";
            break;
          case 2:
            buyInMode += "ENERGY + MINERALS + OPS";
            break;
          case 1:
            buyInMode += "MINERALS";
            break;
          case 0:
            buyInMode += " OFF";
            break;
        }

        ans += `@ ${h.print}:\n${
          addString("depositMining", "deposit") +
          addString("depositRefining", "refining")
        }\n${
          addString("powerMining", "power") +
          addString("powerRefining", "refining")
        }\n${addString("war") + addString("lab")}\n${addString(
          "sellOff"
        )}\n${buyInMode}\n${
          addString("saveCpu", "cpu") + addString("unboost")
        }\n${addString("buildBoost") + addString("upgrade")}\n`;
      }
    );
    return ans;
  }

  public miningDist(value: number) {
    Memory.settings.miningDist = value;
    _.forEach(Apiary.hives, (h) => {
      if (h.cells.observe) h.cells.observe.updateRoomsToCheck();
    });
  }

  public balance(min: number | "fit" = Game.market.credits * 0.8) {
    if (typeof min !== "number") min = Game.market.credits;
    Memory.settings.minBalance = Math.ceil(min);
    return "use credit down to balance of " + Memory.settings.minBalance;
  }

  public format(s: string) {
    if (/\d/.exec(s) !== null) return s.toUpperCase();
    else return s.toLowerCase();
  }

  public showMap(
    roomName: string = this.lastActionRoomName,
    keep: boolean,
    visual: (x: number, y: number, vis: RoomVisual) => void
  ) {
    const terrain = Game.map.getRoomTerrain(roomName);
    Apiary.visuals.changeAnchor(0, 0, roomName);
    for (let x = 0; x <= 49; ++x)
      for (let y = 0; y <= 49; ++y)
        if (terrain.get(x, y) !== TERRAIN_MASK_WALL)
          visual(x, y, Apiary.visuals.anchor.vis);

    Apiary.visuals.exportAnchor(keep ? Infinity : 20);
    return `OK @ ${this.formatRoom(roomName)}`;
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

  public showSiedge(roomName: string, keep = false) {
    const siedge = Apiary.warcrimes.siedge[roomName];
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

  public showBuildMap(
    hiveName: string = this.lastActionRoomName,
    keep = false
  ) {
    const hive = Apiary.hives[hiveName];
    if (!hive) return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
    this.lastActionRoomName = hive.roomName;
    const targets = hive.structuresConst;
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

  public recalcResTime(hiveName?: string) {
    let hives;
    if (hiveName) {
      this.lastActionRoomName = hiveName;
      hives = [Apiary.hives[hiveName]];
    } else hives = _.map(Apiary.hives, (h) => h);
    _.forEach(hives, (h) => {
      _.forEach(h.cells.excavation.resourceCells, (cell) => {
        cell.roadTime = cell.pos.getTimeForPath(
          cell.parentCell.master ? cell.parentCell.master.dropOff.pos : h.pos
        );
        cell.restTime = cell.pos.getTimeForPath(h.rest);
        cell.recalcLairFleeTime();
      });
      _.forEach(h.annexNames, (annexName) => {
        const order = Apiary.orders[prefix.annex + annexName];
        if (
          order &&
          order.flag.color === COLOR_PURPLE &&
          order.flag.secondaryColor === COLOR_PURPLE
        )
          order.memory.extraInfo = 0; // h.pos.getTimeForPath(order)
      });
      h.cells.excavation.shouldRecalc = true;
    });
    return "OK";
  }

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

  // some hand used functions
  public terminal(
    hiveName: string = this.lastActionRoomName,
    amount: number = Infinity,
    resource: ResourceConstant = RESOURCE_ENERGY,
    mode: "fill" | "empty" = "fill"
  ) {
    hiveName = this.format(hiveName);
    const hive = Apiary.hives[hiveName];
    if (!hive) return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
    this.lastActionRoomName = hive.roomName;

    const cell = hive && hive.cells.storage;
    if (!cell || !cell.terminal)
      return `ERROR: TERMINAL NOT FOUND @ ${hive.print}`;

    if (!mode || (mode !== "fill" && mode !== "empty"))
      return `ERROR: NO VALID MODE @ ${hive.print}`;

    if (mode === "fill" && resource === RESOURCE_ENERGY && amount === Infinity)
      amount = Math.min(cell.terminal.store.getFreeCapacity(resource), 11000);

    if (mode === "empty" && resource === RESOURCE_ENERGY)
      amount -= TERMINAL_ENERGY;

    let ans;
    if (amount > 0)
      if (mode === "empty")
        ans = cell.requestToStorage(
          [cell.terminal],
          1,
          resource,
          Math.min(amount, cell.terminal.store.getUsedCapacity(resource))
        );
      else
        ans = cell.requestFromStorage(
          [cell.terminal],
          1,
          resource,
          Math.min(amount, cell.terminal.store.getFreeCapacity(resource))
        );

    return `${mode.toUpperCase()} TERMINAL @ ${
      hive.print
    } \nRESOURCE ${resource.toUpperCase()}: ${ans} `;
  }

  public sendBlind(
    roomNameFrom: string,
    roomNameTo: string,
    resource: ResourceConstant,
    amount: number = Infinity
  ) {
    roomNameFrom = this.format(roomNameFrom);
    roomNameTo = this.format(roomNameTo);
    const hiveFrom = Apiary.hives[roomNameFrom];
    if (!hiveFrom)
      return `ERROR: NO HIVE @ <a href=#!/room/${Game.shard.name}/${roomNameFrom}>${roomNameFrom}</a>`;
    const terminalFrom =
      hiveFrom && hiveFrom.cells.storage && hiveFrom.cells.storage.terminal;
    if (!terminalFrom)
      return `ERROR: FROM TERMINAL NOT FOUND @ ${hiveFrom.print}`;
    if (terminalFrom.cooldown > 0) return "TERMINAL COOLDOWN";

    amount = Math.min(amount, terminalFrom.store.getUsedCapacity(resource));

    const energyCost =
      Game.market.calcTransactionCost(10000, roomNameFrom, roomNameTo) / 10000;
    const energyCap = Math.floor(
      terminalFrom.store.getUsedCapacity(RESOURCE_ENERGY) / energyCost
    );
    amount = Math.min(amount, energyCap);

    if (
      resource === RESOURCE_ENERGY &&
      amount * (1 + energyCost) >
        terminalFrom.store.getUsedCapacity(RESOURCE_ENERGY)
    )
      amount = Math.floor(amount * (1 - energyCost));

    const ans = terminalFrom.send(resource, amount, roomNameTo);

    const info = ` SEND FROM ${
      hiveFrom.print
    } TO ${roomNameTo} \nRESOURCE ${resource.toUpperCase()}: ${amount} \nENERGY: ${Game.market.calcTransactionCost(
      amount,
      roomNameFrom,
      roomNameTo
    )}`;
    if (ans === OK) return "OK" + info;
    else return `ERROR: ${ans}` + info;
  }

  public send(
    roomNameFrom: string,
    roomNameTo: string,
    resource: ResourceConstant = RESOURCE_ENERGY,
    amount: number = Infinity
  ) {
    roomNameFrom = this.format(roomNameFrom);
    roomNameTo = this.format(roomNameTo);
    const hiveFrom = Apiary.hives[roomNameFrom];
    if (!hiveFrom)
      return `ERROR: NO HIVE @ <a href=#!/room/${Game.shard.name}/${roomNameFrom}>${roomNameFrom}</a>`;
    const terminalFrom =
      hiveFrom && hiveFrom.cells.storage && hiveFrom.cells.storage.terminal;
    if (!terminalFrom)
      return `ERROR: FROM TERMINAL NOT FOUND @ ${hiveFrom.print}`;
    if (terminalFrom.cooldown > 0) return "TERMINAL COOLDOWN";
    const hiveTo = Apiary.hives[roomNameTo];
    if (!hiveTo)
      return `ERROR: NO HIVE @ <a href=#!/room/${Game.shard.name}/${roomNameFrom}>${roomNameFrom}</a>`;
    const terminalTo =
      hiveTo && hiveTo.cells.storage && hiveTo.cells.storage.terminal;
    if (!terminalTo) return `ERROR: TO TERMINAL NOT @ ${roomNameTo}`;

    amount = Math.min(amount, terminalFrom.store.getUsedCapacity(resource));
    amount = Math.min(amount, terminalTo.store.getFreeCapacity(resource));

    const energyCost =
      Game.market.calcTransactionCost(10000, roomNameFrom, roomNameTo) / 10000;
    const energyCap = Math.floor(
      terminalFrom.store.getUsedCapacity(RESOURCE_ENERGY) / energyCost
    );
    amount = Math.min(amount, energyCap);

    if (
      resource === RESOURCE_ENERGY &&
      amount * (1 + energyCost) >
        terminalFrom.store.getUsedCapacity(RESOURCE_ENERGY)
    )
      amount = Math.floor(amount * (1 - energyCost));

    const ans = terminalFrom.send(resource, amount, roomNameTo);
    if (ans === OK && Apiary.logger)
      Apiary.logger.newTerminalTransfer(
        terminalFrom,
        terminalTo,
        amount,
        resource
      );

    const info = ` SEND FROM ${hiveFrom.print} TO ${
      hiveTo.print
    } \nRESOURCE ${resource.toUpperCase()}: ${amount} \nENERGY: ${Game.market.calcTransactionCost(
      amount,
      roomNameFrom,
      roomNameTo
    )}`;
    if (ans === OK) return "OK" + info;
    else return `ERROR: ${ans}` + info;
  }

  public transfer(
    roomNameFrom: string,
    roomNameTo: string,
    res: ResourceConstant = RESOURCE_ENERGY,
    amount?: number
  ) {
    console.log(this.terminal(roomNameFrom, amount, res, "fill"));
    console.log(this.terminal(roomNameTo, amount, res, "empty"));
    console.log(this.send(roomNameFrom, roomNameTo, res, amount));
  }

  public changeOrderPrice(orderId: string, newPrice: number) {
    return this.marketReturn(
      Game.market.changeOrderPrice(orderId, newPrice),
      "ORDER CHANGE TO " + newPrice
    );
  }

  public cancelOrdersHive(
    hiveName: string = this.lastActionRoomName,
    nonActive = false
  ) {
    let ans = `OK @ ${this.format(hiveName)}`;
    _.forEach(Game.market.orders, (o) => {
      if (o.roomName === hiveName && (!o.active || nonActive))
        ans +=
          this.marketReturn(
            Apiary.broker.cancelOrder(o.id),
            `canceled ${o.resourceType}`
          ) + "\n";
    });
    return ans;
  }

  public cancelOrder(orderId: string) {
    return this.marketReturn(
      Apiary.broker.cancelOrder(orderId),
      "ORDER CANCEL"
    );
  }

  public completeOrder(orderId: string, roomName?: string, sets: number = 1) {
    const order = Game.market.getOrderById(orderId);
    if (!order) return `ERROR: ORDER NOT FOUND`;
    let amount = Math.min(sets * 5000, order.amount);
    let ans;
    let energy: number | string = "NOT NEEDED";
    let hiveName: string = "NO HIVE";
    if (!order.roomName) {
      ans = Game.market.deal(orderId, amount);
    } else {
      const resource = order.resourceType as ResourceConstant;

      let terminal;
      let validateTerminal = (t: StructureTerminal) =>
        t.store.getUsedCapacity(resource) > amount;
      if (order.type === ORDER_SELL)
        validateTerminal = (t) => t.store.getFreeCapacity(resource) > amount;

      if (roomName)
        terminal = this.getTerminal(roomName, order.type === ORDER_BUY);
      else {
        const validHives = _.filter(
          Apiary.hives,
          (h) =>
            h.cells.storage &&
            h.cells.storage.terminal &&
            validateTerminal(h.cells.storage.terminal)
        );
        if (!validHives.length) return "NO VALID HIVES FOUND";

        const hive = validHives.reduce((prev, curr) =>
          Game.market.calcTransactionCost(100, prev.roomName, order.roomName!) >
          Game.market.calcTransactionCost(100, curr.roomName, order.roomName!)
            ? curr
            : prev
        );
        terminal = hive.cells.storage!.terminal!;
      }

      if (typeof terminal === "string") return terminal;

      hiveName = this.formatRoom(terminal.pos.roomName);

      if (order.type === ORDER_BUY)
        amount = Math.min(amount, terminal.store.getUsedCapacity(resource));
      else amount = Math.min(amount, terminal.store.getFreeCapacity(resource));

      energy = Game.market.calcTransactionCost(
        amount,
        terminal.pos.roomName,
        order.roomName
      );
      ans = Game.market.deal(orderId, amount, terminal.pos.roomName);
      if (ans === OK && order.roomName && Apiary.logger)
        Apiary.logger.marketShort(order, amount, terminal.pos.roomName);
    }

    const info = `${
      order.type === ORDER_SELL ? "BOUGHT" : "SOLD"
    } @ ${hiveName}${
      order.roomName ? " from " + this.formatRoom(order.roomName) : ""
    }\nRESOURCE ${order.resourceType.toUpperCase()}: ${amount} \nMONEY: ${
      amount * order.price
    } \nENERGY: ${energy}`;

    return this.marketReturn(ans, info);
  }

  public getTerminal(roomName: string, checkCooldown = false) {
    const hive = Apiary.hives[roomName];
    if (!hive) return `NO VALID HIVE FOUND @ ${this.formatRoom(roomName)}`;
    this.lastActionRoomName = hive.roomName;
    const terminal = hive.cells.storage && hive.cells.storage.terminal!;
    if (!terminal) return `NO VALID TERMINAL NOT FOUND @ ${hive.print}`;
    if (checkCooldown && terminal.cooldown) return `TERMINAL COOLDOWN`;
    return terminal;
  }

  public buyMastersMinerals(
    padding = 0,
    hiveName: string = this.lastActionRoomName,
    mode = "fast"
  ) {
    const hive = Apiary.hives[hiveName];
    if (!hive) return `NO VALID HIVE FOUND @ ${this.formatRoom(hiveName)}`;
    const state = hive.mastersResTarget;
    let ans = `OK @ ${this.format(hiveName)}`;
    let skip = !hive.room.terminal || !!hive.room.terminal.cooldown;
    _.forEach(state, (amount, r) => {
      if (!amount || !r || r === RESOURCE_ENERGY) return;
      const res = r as ResourceConstant;
      if (!(res in REACTION_MAP) || hive.resState[res]! > 0) return;
      if (skip) {
        ans += `\n${res}: skipped ${amount}`;
        return;
      }
      const sets = Math.min(
        Math.round(((amount + padding) / 5000) * 1000) / 1000,
        1
      );
      let buyAns;
      switch (mode) {
        case "short":
          buyAns = this.buyShort(res, hiveName, sets);
          break;
        case "long":
          buyAns = this.buyLong(res, hiveName, sets);
          break;
        default:
          buyAns = this.buy(res, hiveName, sets, mode === "fast");
      }
      skip = buyAns.includes("short");
      ans += `\n${res}: ${buyAns} ${sets * 5000}/${amount}`;
    });
    return ans;
  }

  public buy(
    resource: ResourceConstant,
    hiveName: string = this.lastActionRoomName,
    sets: number = 1,
    hurry: boolean = false
  ) {
    hiveName = hiveName.toUpperCase();
    const terminal = this.getTerminal(hiveName);
    if (typeof terminal === "string") return terminal;
    Apiary.broker.update();
    return this.marketReturn(
      Apiary.broker.buyIn(terminal, resource, 5000 * sets, hurry, Infinity),
      `${resource.toUpperCase()} @ ${this.formatRoom(hiveName)}`
    );
  }

  public sell(
    resource: ResourceConstant,
    hiveName: string = this.lastActionRoomName,
    sets: number = 1,
    hurry: boolean = false
  ) {
    hiveName = hiveName.toUpperCase();
    const terminal = this.getTerminal(hiveName);
    if (typeof terminal === "string") return terminal;
    Apiary.broker.update();
    return this.marketReturn(
      Apiary.broker.sellOff(terminal, resource, 5000 * sets, hurry, Infinity),
      `${resource.toUpperCase()} @ ${this.formatRoom(hiveName)}`
    );
  }

  public buyShort(
    resource: ResourceConstant,
    hiveName: string = this.lastActionRoomName,
    sets: number = 1
  ) {
    hiveName = hiveName.toUpperCase();
    const terminal = this.getTerminal(hiveName);
    if (typeof terminal === "string") return terminal;
    Apiary.broker.update();
    return this.marketReturn(
      Apiary.broker.buyShort(terminal, resource, 5000 * sets, Infinity),
      `${resource.toUpperCase()} @ ${this.formatRoom(hiveName)}`
    );
  }

  public sellShort(
    resource: ResourceConstant,
    hiveName: string = this.lastActionRoomName,
    sets: number = 1
  ) {
    hiveName = hiveName.toUpperCase();
    const terminal = this.getTerminal(hiveName);
    if (typeof terminal === "string") return terminal;
    Apiary.broker.update();
    return this.marketReturn(
      Apiary.broker.sellShort(terminal, resource, 5000 * sets),
      `${resource.toUpperCase()} @ ${this.formatRoom(hiveName)}`
    );
  }

  public buyLong(
    resource: ResourceConstant,
    hiveName: string = this.lastActionRoomName,
    sets: number = 1
  ) {
    // coef = 0.95
    hiveName = hiveName.toUpperCase();
    const terminal = this.getTerminal(hiveName);
    if (typeof terminal === "string") return terminal;
    Apiary.broker.update();
    return this.marketReturn(
      Apiary.broker.buyLong(
        terminal,
        resource,
        5000 * sets,
        Infinity,
        Apiary.broker.priceLongBuy(resource, 0.02)
      ),
      `${resource.toUpperCase()} @ ${this.formatRoom(hiveName)}`
    );
  }

  public sellLong(
    resource: ResourceConstant,
    hiveName: string = this.lastActionRoomName,
    sets: number = 1,
    price?: number
  ) {
    // coef = 1.05
    hiveName = hiveName.toUpperCase();
    const terminal = this.getTerminal(hiveName);
    if (typeof terminal === "string") return terminal;
    Apiary.broker.update();
    return this.marketReturn(
      Apiary.broker.sellLong(
        terminal,
        resource,
        5000 * sets,
        Infinity,
        price || Apiary.broker.priceLongSell(resource, 0.02)
      ),
      `${resource.toUpperCase()} @ ${this.formatRoom(hiveName)}`
    );
  }

  public marketReturn(ans: number | string, info: string) {
    switch (ans) {
      case ERR_NOT_FOUND:
        ans = "NO GOOD DEAL NEAR";
        break;
      case ERR_NOT_ENOUGH_RESOURCES:
        ans = "NOT ENOUGH RESOURCES";
        break;
      case OK:
        return "OK " + info;
    }
    return `${typeof ans === "number" ? "ERROR: " : ""}${ans} ` + info;
  }

  public update(roomName: string = this.lastActionRoomName, cache: RoomSetup) {
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
  }

  public cleanIntel(
    quadToclean: string,
    xmin: number,
    xmax: number,
    ymin: number,
    ymax: number
  ) {
    const quad = /^([WE])([NS])$/.exec(quadToclean);
    for (const roomName in Memory.cache.intellegence) {
      const parsed = /^([WE])([0-9]+)([NS])([0-9]+)$/.exec(roomName);
      if (parsed && quad) {
        const [, we, x, ns, y] = parsed;
        const state = Apiary.intel.getInfo(roomName, Infinity).roomState;
        if (
          we === quad[1] &&
          ns === quad[2] &&
          (+x < xmin ||
            +x > xmax ||
            +y < ymin ||
            +y > ymax ||
            (state > roomStates.reservedByMe &&
              state < roomStates.reservedByEnemy))
        )
          delete Memory.cache.intellegence[roomName];
      } else delete Memory.cache.intellegence[roomName];
    }
  }

  public formatRoom(roomName: string, text: string = roomName) {
    return `<a href=#!/room/${Game.shard.name}/${roomName}>${text}</a>`;
  }
}
