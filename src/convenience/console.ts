import { signText, prefix, roomStates } from "../enums";

import { TERMINAL_ENERGY } from "../cells/stage1/storageCell";
import { REACTION_MAP } from "../cells/stage1/laboratoryCell";
import { makeId } from "../abstract/utils";
import { setups } from "../bees/creepSetups";

import type { RoomSetup } from "../abstract/roomPlanner";
import type { Master } from "../beeMasters/_Master";
import type { TransferRequest } from "../bees/transferRequest";

export class CustomConsole {
  lastActionRoomName: string;

  constructor() {
    this.lastActionRoomName = _.map(Apiary.hives, h => h).reduce((prev, curr) => prev.room.controller!.level < curr.room.controller!.level ? curr : prev).roomName;
  }

  vis(framerate?: number, force: number = 0) {
    if (Apiary.visuals)
      for (let name in Apiary.visuals.caching) {
        if (framerate === undefined && Apiary.visuals.caching[name].lastRecalc - Game.time > 5)
          framerate = Memory.settings.framerate; // updating some sticky state
        Apiary.visuals.caching[name].lastRecalc = Game.time;
      }

    Memory.settings.framerate = framerate !== undefined ? framerate : (Memory.settings.framerate !== 1 ? 1 : 0);
    Memory.settings.forceBucket = force;

    return `framerate: ${Memory.settings.framerate}${Memory.settings.forceBucket ? ", ignoring bucket" : ""}`;
  }

  h(hiveName: string = this.lastActionRoomName) {
    hiveName = this.format(hiveName);
    let hive = Apiary.hives[hiveName];
    if (!hive)
      return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
    this.lastActionRoomName = hive.roomName;
    return `active hive is ${this.lastActionRoomName}`;
  }

  balance(min: number | "fit" = Game.market.credits * 0.8) {
    if (typeof min !== "number")
      min = Game.market.credits;
    Memory.settings.minBalance = Math.ceil(min);
    return "use credit down to balance of " + Memory.settings.minBalance;
  }

  format(s: string) {
    if (/\d/.exec(s) !== null)
      return s.toUpperCase();
    else
      return s.toLowerCase();
  }

  showMap(roomName: string = this.lastActionRoomName, keep: boolean, visual: (x: number, y: number, vis: RoomVisual) => void) {
    let terrain = Game.map.getRoomTerrain(roomName);
    Apiary.visuals.changeAnchor(0, 0, roomName);
    for (let x = 0; x <= 49; ++x)
      for (let y = 0; y <= 49; ++y)
        if (terrain.get(x, y) !== TERRAIN_MASK_WALL)
          visual(x, y, Apiary.visuals.anchor.vis);

    Apiary.visuals.exportAnchor(keep ? Infinity : 20);
    return `OK @ ${this.formatRoom(roomName)}`;
  }

  showBreach(hiveName: string = this.lastActionRoomName, keep = false) {
    let hive = Apiary.hives[hiveName];
    if (!hive)
      return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
    this.lastActionRoomName = hive.roomName;
    let mask = Apiary.useBucket ? 1 : 3;
    return this.showMap(hiveName, keep, (x, y, vis) => {
      if (x % mask === 0 && y % mask === 0) {
        let pos = new RoomPosition(x, y, hiveName);
        if (!pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART).length
          && hive.cells.defense.wasBreached(pos))
          vis.circle(x, y, { radius: 0.2, fill: "#E75050" });
      }
    });
  }

  showSpawnMap(hiveName: string = this.lastActionRoomName, keep = false) {
    let hive = Apiary.hives[hiveName];
    if (!hive)
      return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
    this.lastActionRoomName = hive.roomName;
    let targets = hive.cells.spawn.getTargets(-1);
    return this.showMap(hiveName, keep, (x, y, vis) => {
      // not best way around it but i am too lazy to rewrite my old visual code for this edge usecase
      for (let i = 0; i < targets.length; ++i) {
        let t = targets[i];
        if (t.pos.x === x && t.pos.y == y) {
          vis.text("" + i, x, y + 0.14,
            Apiary.visuals.textStyle({ opacity: 1, font: 0.35, strokeWidth: 0.75, color: "#1C6F21", align: "center" }));
          break;
        }
      }
    });
  }

  showDefMap(hiveName: string = this.lastActionRoomName, keep = false) {
    let hive = Apiary.hives[hiveName];
    if (!hive)
      return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
    this.lastActionRoomName = hive.roomName;
    let max = Math.max(...hive.cells.defense.coefMap.map(row => Math.max(...row)));
    return this.showMap(hiveName, keep, (x, y, vis) => {
      vis.circle(x, y, { radius: 0.2, fill: "#70E750", opacity: Math.pow(hive.cells.defense.coefMap[x][y] / max, 3) });
    });
  }

  showNukeDefMap(hiveName: string = this.lastActionRoomName, keep = false) {
    let hive = Apiary.hives[hiveName];
    if (!hive)
      return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
    this.lastActionRoomName = hive.roomName;
    let defMap = hive.cells.defense.getNukeDefMap()
    return this.showMap(hiveName, keep, (x, y, vis) => {
      if (_.filter(defMap, p => p.pos.x === x && p.pos.y === y).length)
        vis.circle(x, y, { opacity: 0.3, fill: "#A1FF80", radius: 0.5, });
    });
  }

  showEnergy(hiveName: string = this.lastActionRoomName, keep?: boolean, x: number = 1, y: number = 1) {
    Apiary.visuals.changeAnchor(x, y, hiveName);
    Apiary.visuals.visualizeEnergy(hiveName);
    Apiary.visuals.exportAnchor(keep ? Infinity : 20);
    return `OK @ ${this.formatRoom(hiveName)}`;
  }

  pickup(hiveName: string = this.lastActionRoomName) {
    hiveName = this.format(hiveName);
    let hive = Apiary.hives[hiveName];
    if (!hive)
      return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
    this.lastActionRoomName = hive.roomName;
    if (!hive.cells.storage)
      return `ERROR: NO STORAGE CELL @ ${this.formatRoom(hiveName)}`;
    let ans = hive.cells.storage.pickupResources();
    return `SCHEDULED ${ans} UNITS`;
  }

  spawnBuilder(patternLimit = Infinity, hiveName: string = this.lastActionRoomName) {
    hiveName = this.format(hiveName);
    let hive = Apiary.hives[hiveName];
    if (!hive)
      return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
    this.lastActionRoomName = hive.roomName;
    if (!hive.builder)
      return `ERROR: NO BUILDER @ ${this.formatRoom(hiveName)}`;
    let builder = setups.builder.copy();
    builder.patternLimit = patternLimit;
    hive.builder.wish({ setup: builder, priority: 1 });
    return `BUILDER SPAWNED @ ${hiveName}`;
  }

  spawnUpgrader(patternLimit = Infinity, hiveName: string = this.lastActionRoomName) {
    hiveName = this.format(hiveName);
    let hive = Apiary.hives[hiveName];
    if (!hive)
      return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
    this.lastActionRoomName = hive.roomName;
    if (!hive.cells.upgrade)
      return `ERROR: NO UPGRADE CELL @ ${this.formatRoom(hiveName)}`;
    let upgrader;
    if (hive.cells.upgrade.master.fastModePossible)
      upgrader = setups.upgrader.fast.copy();
    else
      upgrader = setups.upgrader.manual.copy();
    upgrader.patternLimit = patternLimit;
    hive.cells.upgrade.master.wish({ setup: upgrader, priority: 1 });
    return `UPGRADER SPAWNED @ ${hiveName}`;
  }

  removeConst() {
    let saved: string[] = [];
    _.forEach(Game.constructionSites, c => {
      if (!c.progress)
        c.remove();
      else if (saved.indexOf(c.pos.roomName) === -1)
        saved.push(c.pos.roomName);
    });
    return "non empty constructionSites in " + saved.map(r => this.formatRoom(r)).join(" ");
  }

  // some hand used functions
  terminal(hiveName: string = this.lastActionRoomName, amount: number = Infinity, resource: ResourceConstant = RESOURCE_ENERGY, mode: "fill" | "empty" = "fill") {
    hiveName = this.format(hiveName);
    let hive = Apiary.hives[hiveName];
    if (!hive)
      return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
    this.lastActionRoomName = hive.roomName;

    let cell = hive && hive.cells.storage;
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
        ans = cell.requestToStorage([cell.terminal], 1, resource, Math.min(amount, cell.terminal.store.getUsedCapacity(resource)));
      else
        ans = cell.requestFromStorage([cell.terminal], 1, resource, Math.min(amount, cell.terminal.store.getFreeCapacity(resource)));

    return `${mode.toUpperCase()} TERMINAL @ ${hive.print} \nRESOURCE ${resource.toUpperCase()}: ${ans} `;
  }

  sendBlind(roomNameFrom: string, roomNameTo: string, resource: ResourceConstant, amount: number = Infinity) {
    roomNameFrom = this.format(roomNameFrom);
    roomNameTo = this.format(roomNameTo);
    let hiveFrom = Apiary.hives[roomNameFrom];
    if (!hiveFrom)
      return `ERROR: NO HIVE @ <a href=#!/room/${Game.shard.name}/${roomNameFrom}>${roomNameFrom}</a>`;
    let terminalFrom = hiveFrom && hiveFrom.cells.storage && hiveFrom.cells.storage!.terminal;
    if (!terminalFrom)
      return `ERROR: FROM TERMINAL NOT FOUND @ ${hiveFrom.print}`;
    if (terminalFrom.cooldown > 0)
      return "TERMINAL COOLDOWN";

    amount = Math.min(amount, terminalFrom.store.getUsedCapacity(resource));

    let energyCost = Game.market.calcTransactionCost(10000, roomNameFrom, roomNameTo) / 10000;
    let energyCap = Math.floor(terminalFrom.store.getUsedCapacity(RESOURCE_ENERGY) / energyCost);
    amount = Math.min(amount, energyCap);

    if (resource === RESOURCE_ENERGY && amount * (1 + energyCost) > terminalFrom.store.getUsedCapacity(RESOURCE_ENERGY))
      amount = Math.floor(amount * (1 - energyCost));

    let ans = terminalFrom.send(resource, amount, roomNameTo);

    let info = ` SEND FROM ${hiveFrom.print} TO ${roomNameTo} \nRESOURCE ${resource.toUpperCase()}: ${amount
      } \nENERGY: ${Game.market.calcTransactionCost(amount, roomNameFrom, roomNameTo)}`;
    if (ans === OK)
      return "OK" + info;
    else
      return `ERROR: ${ans}` + info;
  }

  send(roomNameFrom: string, roomNameTo: string, resource: ResourceConstant = RESOURCE_ENERGY, amount: number = Infinity) {
    roomNameFrom = this.format(roomNameFrom);
    roomNameTo = this.format(roomNameTo);
    let hiveFrom = Apiary.hives[roomNameFrom];
    if (!hiveFrom)
      return `ERROR: NO HIVE @ <a href=#!/room/${Game.shard.name}/${roomNameFrom}>${roomNameFrom}</a>`;
    let terminalFrom = hiveFrom && hiveFrom.cells.storage && hiveFrom.cells.storage!.terminal;
    if (!terminalFrom)
      return `ERROR: FROM TERMINAL NOT FOUND @ ${hiveFrom.print}`;
    if (terminalFrom.cooldown > 0)
      return "TERMINAL COOLDOWN";
    let hiveTo = Apiary.hives[roomNameTo];
    if (!hiveTo)
      return `ERROR: NO HIVE @ <a href=#!/room/${Game.shard.name}/${roomNameFrom}>${roomNameFrom}</a>`;
    let terminalTo = hiveTo && hiveTo.cells.storage && hiveTo.cells.storage!.terminal;
    if (!terminalTo)
      return `ERROR: TO TERMINAL NOT @ ${roomNameTo}`;

    amount = Math.min(amount, terminalFrom.store.getUsedCapacity(resource));
    amount = Math.min(amount, terminalTo.store.getFreeCapacity(resource));

    let energyCost = Game.market.calcTransactionCost(10000, roomNameFrom, roomNameTo) / 10000;
    let energyCap = Math.floor(terminalFrom.store.getUsedCapacity(RESOURCE_ENERGY) / energyCost);
    amount = Math.min(amount, energyCap);

    if (resource === RESOURCE_ENERGY && amount * (1 + energyCost) > terminalFrom.store.getUsedCapacity(RESOURCE_ENERGY))
      amount = Math.floor(amount * (1 - energyCost));

    let ans = terminalFrom.send(resource, amount, roomNameTo);
    if (ans === OK && Apiary.logger)
      Apiary.logger.newTerminalTransfer(terminalFrom, terminalTo, amount, resource);

    let info = ` SEND FROM ${hiveFrom.print} TO ${hiveTo.print} \nRESOURCE ${resource.toUpperCase()}: ${amount
      } \nENERGY: ${Game.market.calcTransactionCost(amount, roomNameFrom, roomNameTo)}`;
    if (ans === OK)
      return "OK" + info;
    else
      return `ERROR: ${ans}` + info;
  }

  transfer(roomNameFrom: string, roomNameTo: string, res: ResourceConstant = RESOURCE_ENERGY, amount?: number) {
    console.log(this.terminal(roomNameFrom, amount, res, "fill"));
    console.log(this.terminal(roomNameTo, amount, res, "empty"));
    console.log(this.send(roomNameFrom, roomNameTo, res, amount));
  }

  changeOrderPrice(orderId: string, newPrice: number) {
    return this.marketReturn(Game.market.changeOrderPrice(orderId, newPrice), "ORDER CHANGE TO " + newPrice);
  }

  cancelOrdersHive(hiveName: string = this.lastActionRoomName, nonActive = false) {
    let ans = `OK @ ${this.format(hiveName)}`;
    _.forEach(Game.market.orders, o => {
      if (o.roomName === hiveName && (!o.active || nonActive))
        ans += this.marketReturn(Apiary.broker.cancelOrder(o.id), `canceled ${o.resourceType}`) + "\n";
    });
    return ans;
  }

  cancelOrder(orderId: string) {
    return this.marketReturn(Apiary.broker.cancelOrder(orderId), "ORDER CANCEL");
  }

  completeOrder(orderId: string, roomName?: string, sets: number = 1) {
    let order = Game.market.getOrderById(orderId);
    if (!order)
      return `ERROR: ORDER NOT FOUND`;
    let amount = Math.min(sets * 5000, order.amount);
    let ans;
    let energy: number | string = "NOT NEEDED";
    let hiveName: string = "NO HIVE";
    if (!order.roomName) {
      ans = Game.market.deal(orderId, amount);
    } else {
      let resource = <ResourceConstant>order.resourceType;


      let terminal;
      let validateTerminal = (t: StructureTerminal) => t.store.getUsedCapacity(resource) > amount;
      if (order.type === ORDER_SELL)
        validateTerminal = (t) => t.store.getFreeCapacity(resource) > amount;

      if (roomName)
        terminal = this.getTerminal(roomName, order.type === ORDER_BUY);
      else {
        let validHives = _.filter(Apiary.hives, h => h.cells.storage && h.cells.storage.terminal && validateTerminal(h.cells.storage.terminal));
        if (!validHives.length)
          return "NO VALID HIVES FOUND";

        let hive = validHives.reduce((prev, curr) => Game.market.calcTransactionCost(100, prev.roomName, order!.roomName!) >
          Game.market.calcTransactionCost(100, curr.roomName, order!.roomName!) ? curr : prev);
        terminal = hive.cells.storage!.terminal!;
      }

      if (typeof terminal === "string")
        return terminal;

      hiveName = this.formatRoom(terminal.pos.roomName);

      if (order.type === ORDER_BUY)
        amount = Math.min(amount, terminal.store.getUsedCapacity(resource));
      else
        amount = Math.min(amount, terminal.store.getFreeCapacity(resource));

      energy = Game.market.calcTransactionCost(amount, terminal.pos.roomName, order.roomName);
      ans = Game.market.deal(orderId, amount, terminal.pos.roomName);
      if (ans === OK && order.roomName && Apiary.logger)
        Apiary.logger.marketShort(order, amount, terminal.pos.roomName);
    }

    let info = `${order.type === ORDER_SELL ? "BOUGHT" : "SOLD"} @ ${hiveName}${order.roomName ? " from " + this.formatRoom(order.roomName) : ""
      }\nRESOURCE ${order.resourceType.toUpperCase()}: ${amount} \nMONEY: ${amount * order.price} \nENERGY: ${energy}`;

    return this.marketReturn(ans, info);
  }

  getTerminal(roomName: string, checkCooldown = false) {
    let hive = Apiary.hives[roomName];
    if (!hive)
      return `NO VALID HIVE FOUND @ ${this.formatRoom(roomName)}`;
    this.lastActionRoomName = hive.roomName;
    let terminal = hive.cells.storage && hive.cells.storage.terminal!;
    if (!terminal)
      return `NO VALID TERMINAL NOT FOUND @ ${hive.print}`;
    if (checkCooldown && terminal.cooldown)
      return `TERMINAL COOLDOWN`;
    return terminal;
  }

  buyMastersMinerals(padding = 0, hiveName: string = this.lastActionRoomName, mode = "fast") {
    let hive = Apiary.hives[hiveName];
    if (!hive)
      return `NO VALID HIVE FOUND @ ${this.formatRoom(hiveName)}`;
    let state = hive.mastersResTarget;
    let ans = `OK @ ${this.format(hiveName)}`;
    _.forEach(state, (amount, r) => {
      if (!amount || !r || r === RESOURCE_ENERGY)
        return;
      let res = <ResourceConstant>r;
      if (!(res in REACTION_MAP) || hive.resState[res]! > 0)
        return;
      let sets = Math.min(Math.round((amount + padding) / 5000 * 1000) / 1000, 1);
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
      ans += `\n${res}: ${buyAns} ${sets * 5000}/${amount}`;
    });
    return ans;
  }

  buy(resource: ResourceConstant, hiveName: string = this.lastActionRoomName, sets: number = 1, hurry: boolean = false) {
    hiveName = hiveName.toUpperCase();
    let terminal = this.getTerminal(hiveName);
    if (typeof terminal === "string")
      return terminal;
    Apiary.broker.update();
    return this.marketReturn(Apiary.broker.buyIn(terminal, resource, 5000 * sets, hurry, Infinity), `${resource.toUpperCase()} @ ${this.formatRoom(hiveName)}`);
  }

  sell(resource: ResourceConstant, hiveName: string = this.lastActionRoomName, sets: number = 1, hurry: boolean = false) {
    hiveName = hiveName.toUpperCase();
    let terminal = this.getTerminal(hiveName);
    if (typeof terminal === "string")
      return terminal;
    Apiary.broker.update();
    return this.marketReturn(Apiary.broker.sellOff(terminal, resource, 5000 * sets, hurry, Infinity), `${resource.toUpperCase()} @ ${this.formatRoom(hiveName)}`);
  }

  buyShort(resource: ResourceConstant, hiveName: string = this.lastActionRoomName, sets: number = 1) {
    hiveName = hiveName.toUpperCase();
    let terminal = this.getTerminal(hiveName);
    if (typeof terminal === "string")
      return terminal;
    Apiary.broker.update();
    return this.marketReturn(Apiary.broker.buyShort(terminal, resource, 5000 * sets, Infinity), `${resource.toUpperCase()} @ ${this.formatRoom(hiveName)}`);
  }

  sellShort(resource: ResourceConstant, hiveName: string = this.lastActionRoomName, sets: number = 1) {
    hiveName = hiveName.toUpperCase();
    let terminal = this.getTerminal(hiveName);
    if (typeof terminal === "string")
      return terminal;
    Apiary.broker.update();
    return this.marketReturn(Apiary.broker.sellShort(terminal, resource, 5000 * sets), `${resource.toUpperCase()} @ ${this.formatRoom(hiveName)}`);
  }

  buyLong(resource: ResourceConstant, hiveName: string = this.lastActionRoomName, sets: number = 1) { // coef = 0.95
    hiveName = hiveName.toUpperCase();
    let terminal = this.getTerminal(hiveName);
    if (typeof terminal === "string")
      return terminal;
    Apiary.broker.update();
    return this.marketReturn(Apiary.broker.buyLong(terminal, resource, 5000 * sets, Infinity
      , Apiary.broker.priceLongBuy(resource, 0.02)), `${resource.toUpperCase()} @ ${this.formatRoom(hiveName)}`);
  }

  sellLong(resource: ResourceConstant, hiveName: string = this.lastActionRoomName, sets: number = 1, price?: number) { // coef = 1.05
    hiveName = hiveName.toUpperCase();
    let terminal = this.getTerminal(hiveName);
    if (typeof terminal === "string")
      return terminal;
    Apiary.broker.update();
    return this.marketReturn(Apiary.broker.sellLong(terminal, resource, Infinity, 5000 * sets
      , price || Apiary.broker.priceLongSell(resource, 0.02)), `${resource.toUpperCase()} @ ${this.formatRoom(hiveName)}`);
  }

  marketReturn(ans: number | string, info: string) {
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

  produce(resource: string, hiveName: string = this.lastActionRoomName) {
    hiveName = hiveName.toUpperCase();
    resource = resource.toUpperCase();

    let hive = Apiary.hives[hiveName];
    if (!hive)
      return `ERROR: NO HIVE @ ${this.formatRoom(hiveName)}`;
    this.lastActionRoomName = hive.roomName;
    if (!hive.cells.lab)
      return `ERROR: LAB NOT FOUND @ ${hive.print}`;
    let pos = hive.cells.lab.pos;

    let productionFlag = pos.lookFor(LOOK_FLAGS).filter(f => f.color === COLOR_GREY && f.secondaryColor === COLOR_CYAN).pop();
    let ref = hiveName + "_" + resource;
    if (!productionFlag || ref !== productionFlag.name) {
      if (productionFlag)
        productionFlag.remove();
      pos.createFlag(ref, COLOR_GREY, COLOR_CYAN);
    } else
      return `ALREADY EXISTS @ ${hive.print}`;
    return `OK @ ${hive.print}`;
  }

  update(roomName: string = this.lastActionRoomName, cache: RoomSetup) {
    if (!(roomName in Game.rooms))
      return `CANNOT ACCESS ${this.formatRoom(roomName)}`
    if (!Memory.cache.roomPlanner[roomName])
      return `NO PREVIOUS CACHE FOUND @ ${this.formatRoom(roomName)}`;

    if (!(roomName in Apiary.planner.activePlanning))
      return `ACTIVATE ACTIVE PLANNING FIRST @ ${this.formatRoom(roomName)}`

    for (let t in cache) {
      let val: BuildableStructureConstant | null = <BuildableStructureConstant>t;
      if (!(t in CONSTRUCTION_COST))
        if (t === "null")
          val = null;
        else
          continue;
      for (let i in cache[<BuildableStructureConstant>t]!.pos) {
        let pos = cache[<BuildableStructureConstant>t]!.pos[i];
        Apiary.planner.addToPlan(pos, roomName, val, true);
      }
    }
    let contr = Game.rooms[roomName].controller && Game.rooms[roomName].controller!.pos;
    let pos = contr && [new RoomPosition(contr.x, contr.y + 1, roomName), new RoomPosition(contr.x, contr.y - 1, roomName)]
      .filter(p => p.lookFor(LOOK_FLAGS).length == 0)[0];
    if (pos)
      pos.createFlag("change_" + roomName + "_" + makeId(4), COLOR_WHITE, COLOR_ORANGE);
    else
      return `ERROR: TOO MUCH FLAGS @ ${this.formatRoom(roomName)}`;

    return "OK";
  }

  sign(textMy = signText.my, textAnnex = signText.annex, textOther = signText.other) {
    let sgn = [];
    for (let name in Game.creeps) {
      let creep = Game.creeps[name];
      if (!creep.getBodyParts(CLAIM))
        continue;
      let controller = <StructureController | undefined>creep.pos.findInRange(FIND_STRUCTURES, 1).filter(s => s.structureType === STRUCTURE_CONTROLLER)[0];
      if (!controller)
        continue;

      let text = textOther;
      if (controller.my)
        text = textMy;
      else if (controller.reservation && controller.reservation.username === Apiary.username)
        text = textAnnex;
      let ans = creep.signController(controller, text);
      if (ans === OK)
        sgn.push(controller.pos.roomName + " " + text);
      else
        console.log(`ERROR @ ${this.formatRoom(controller.pos.roomName)}: ${ans}`);
    }
    return `SIGNED ${sgn.length} controllers${sgn.length ? "\n" : ""}` + sgn.join("\n");
  }

  printHives() {
    return _.map(Apiary.hives, o => o.print).join('\n');
  }

  printByHive(obj: { print: string, hive: { roomName: string } }[]) {
    return _.compact(_.map(Apiary.hives, h => {
      let objHive = _.map(_.filter(obj, o => o.hive.roomName === h.roomName), o => o.print);
      if (!objHive.length)
        return;
      return `${h.print}:\n${objHive.join('\n')}\n----------`;
    })).join('\n');
  }

  printByMasters(obj: { print: string, master?: { ref: string } }[]) {
    return _.compact((<(Master | undefined)[]>_.map(Apiary.masters).concat([undefined])).map(m => {
      let objHive = _.map(_.filter(obj, o => (!m && !o.master) || (m && o.master && o.master.ref === m.ref)), o => o.print);
      if (!objHive.length)
        return;
      return `${m ? m.print : "None"}:\n${objHive.join('\n')}\n----------`;
    })).join('\n');
  }

  printMasters(ref?: string) {
    let obj = _.filter(Apiary.masters, m => !ref || m.hive.roomName === ref || m.ref.includes(ref));
    return this.printByHive(obj);
  }

  printOrders(ref?: string) {
    let extraFilter = (rr: string) => !rr.includes(prefix.annex) && !rr.includes(prefix.mine) && !rr.includes(prefix.puppet)
    let obj = _.filter(Apiary.orders, o => (!ref || o.hive.roomName === ref || o.ref.includes(ref)) && extraFilter(o.ref));
    return this.printByHive(obj);
  }

  printBees(ref?: string, byHives: boolean = false) {
    let bees = _.filter(Apiary.bees, b => !ref || b.creep.memory.refMaster.includes(ref));
    if (byHives) {
      let obj = _.map(bees, b => { return { print: b.print, hive: { roomName: b.master ? b.master.hive.roomName : "none" } } });
      return this.printByHive(obj);
    }
    let obj = _.map(bees, b => { return { print: b.print, master: b.master } });
    return this.printByMasters(obj);
  }

  formatRoom(roomName: string, text: string = roomName) {
    return `<a href=#!/room/${Game.shard.name}/${roomName}>${text}</a>`
  }

  printSpawnOrders(hiveName: string = this.lastActionRoomName) {
    return _.map(_.filter(Apiary.hives, h => !hiveName || h.roomName === hiveName), h => `${h.print}: \n${
      _.map(_.map(h.spawOrders, (order, master) => { return { order: order, master: master! } }).sort(
        (a, b) => a.order.priority - b.order.priority),
        o => `${o.order.priority} ${o.master}: ${o.order.setup.name}`).join('\n')
      } \n`).join('\n');
  }

  printStorageOrders(hiveName: string = this.lastActionRoomName) {
    return _.map(_.filter(Apiary.hives, h => !hiveName || h.roomName === hiveName), h => {
      if (!h.cells.storage)
        return "";
      return `${h.print}: \n${
        _.map((<TransferRequest[]>_.map(h.cells.storage.requests)).sort((a, b) => a.priority - b.priority),
          o => `${o.isValid() ? "" : "-"} ${o.priority} ${o.ref}: ${o.from instanceof Structure ? o.from.structureType : o.from} -> ${o.resource}${o.amount !== Infinity ? ": " + o.amount : ""} -> ${o.to.structureType}`).join('\n')
        } \n`
    }).join('\n');
  }

  cleanIntel(quadToclean: string, xmin: number, xmax: number, ymin: number, ymax: number) {
    for (let roomName in Memory.cache.intellegence) {
      let parsed = /^([WE])([0-9]+)([NS])([0-9]+)$/.exec(roomName);
      let quad = /^([WE])([NS])$/.exec(quadToclean)
      if (parsed && quad) {
        let [, we, x, ns, y] = parsed;
        let state = Apiary.intel.getInfo(roomName, Infinity).roomState;
        if (we === quad[1] && ns == quad[2] && (+x < xmin || +x > xmax || +y < ymin || +y > ymax || (state > roomStates.reservedByMe && state < roomStates.reservedByEnemy)))
          delete Memory.cache.intellegence[roomName];
      } else
        delete Memory.cache.intellegence[roomName];
    }
  }
}
