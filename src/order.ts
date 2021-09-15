import { hordeDefenseMaster } from "./beeMasters/war/hordeDefense";
import { hordeMaster } from "./beeMasters/war/horde";
import { downgradeMaster } from "./beeMasters/war/downgrader";
import { dismantlerMaster } from "./beeMasters/war/dismantler";
import { waiterMaster } from "./beeMasters/war/waiter";
import { squadMaster } from "./beeMasters/war/squad";

import type { ReactionConstant } from "./cells/stage1/laboratoryCell";

import type { Master } from "./beeMasters/_Master";
import type { Hive, HivePositions } from "./Hive";
import { dupletMaster } from "./beeMasters/civil/miningDuplet";
import { puppetMaster } from "./beeMasters/civil/puppet";
import { annexMaster } from "./beeMasters/civil/annexer";
import { pickupMaster } from "./beeMasters/civil/pickup";
import { claimerMaster } from "./beeMasters/civil/claimer";
import { skMaster } from "./beeMasters/civil/safeSK";

import { bootstrapMaster } from "./beeMasters/economy/bootstrap";

import { makeId } from "./abstract/utils";
import { profile } from "./profiler/decorator";
import { LOGGING_CYCLE } from "./settings";

export enum prefix {
  upgrade = "polen",
  surrender = "fff"
}

@profile
export class Order {
  ref: string;
  flag: Flag;
  pos: RoomPosition;
  master?: Master;
  hive: Hive;
  acted: boolean = false;

  constructor(flag: Flag) {
    this.ref = flag.name;
    this.flag = flag;
    this.pos = flag.pos;

    if (this.flag.memory.hive && Apiary.hives[this.flag.memory.hive]) {
      this.hive = Apiary.hives[this.flag.memory.hive];
      if (!this.hive)
        this.delete();
    } else {
      let filter: (h: Hive) => boolean = (h) => h.stage >= 2;;
      switch (this.flag.color) {
        case COLOR_CYAN:
          filter = (h) => h.roomName === this.pos.roomName && h.stage >= 1;
          break;
        case COLOR_PURPLE:
          if (this.flag.secondaryColor === COLOR_WHITE)
            filter = (h) => h.roomName !== this.pos.roomName;
          if (this.flag.secondaryColor !== COLOR_PURPLE)
            break;
        case COLOR_YELLOW: case COLOR_WHITE:
          filter = (_) => true;
          break;
        case COLOR_GREY:
          if (this.flag.secondaryColor === COLOR_YELLOW)
            filter = (_) => true;
      }
      this.hive = this.findHive(filter);
    }
    let newMemory: FlagMemory = { hive: this.hive.roomName };
    if (this.flag.memory.info)
      newMemory.info = this.flag.memory.info;
    if (this.flag.memory.repeat)
      newMemory.info = this.flag.memory.repeat;
    this.flag.memory = newMemory;
  }

  findHive(filter: (h: Hive) => boolean = () => true): Hive {
    if (Apiary.hives[this.pos.roomName] && filter(Apiary.hives[this.pos.roomName]))
      return Apiary.hives[this.pos.roomName];

    for (const k in Game.map.describeExits(this.pos.roomName)) {
      let exit = Game.map.describeExits(this.pos.roomName)[<ExitKey>k];
      if (exit && Apiary.hives[exit] && filter(Apiary.hives[exit]))
        return Apiary.hives[exit];
    }

    // well time to look for faraway boys
    let validHives = _.filter(Apiary.hives, filter);
    if (!validHives.length)
      validHives = _.map(Apiary.hives);

    let bestHive = validHives.pop()!; // if i don't have a single hive wtf am i doing
    let dist = this.pos.getRoomRangeTo(bestHive);
    _.forEach(validHives, (h) => {
      let newDist = this.pos.getRoomRangeTo(h);
      if (newDist < dist) {
        dist = newDist;
        bestHive = h;
      }
    });
    return bestHive;
  }

  uniqueFlag(local: boolean = true) {
    if (this.pos.roomName in Game.rooms) {
      _.forEach(Game.flags, (f) => {
        if (f.color === this.flag.color && f.secondaryColor === this.flag.secondaryColor
          && (!local || f.pos.roomName === this.pos.roomName) && f.name !== this.ref && Apiary.orders[f.name])
          Apiary.orders[f.name].delete();
      });
      return OK;
    }
    return ERR_NOT_FOUND;
  }

  fixedName(name: string) {
    if (this.pos.roomName in Game.rooms) {
      if (this.ref !== name) {
        this.pos.createFlag(name, this.flag.color, this.flag.secondaryColor);
        this.delete();
      }
    } else
      this.acted = false;
  }

  act() {
    this.acted = true;
    switch (this.flag.color) {
      case COLOR_RED:
        this.flag.memory.repeat = this.flag.memory.repeat ? this.flag.memory.repeat : 0;
        if (/^def_/.exec(this.ref) !== null)
          Apiary.defenseSwarms[this.pos.roomName] = this;
        if (!this.master)
          switch (this.flag.secondaryColor) {
            case COLOR_BLUE:
              this.master = new hordeDefenseMaster(this);
              break;
            case COLOR_RED:
              let master = new hordeMaster(this);
              let regex = /^\d*/.exec(this.ref);
              if (regex && regex[0])
                master.maxSpawns = +regex[0];
              else if (/^def_/.exec(this.ref) !== null)
                master.maxSpawns = 1;
              this.master = master;
              break;
            case COLOR_PURPLE:
              this.master = new downgradeMaster(this);
              break;
            case COLOR_BROWN:
              this.master = new dismantlerMaster(this);
              break;
            case COLOR_GREEN:
              this.master = new waiterMaster(this);
              break;
            case COLOR_ORANGE:
              this.master = new squadMaster(this);
              break;
            case COLOR_YELLOW:
              this.master = new dupletMaster(this);
              break;
            case COLOR_CYAN:
              this.master = new skMaster(this);
              break;
            case COLOR_WHITE:
              this.fixedName(prefix.surrender + this.hive.roomName);
              break;
          }
        break;
      case COLOR_PURPLE:
        switch (this.flag.secondaryColor) {
          case COLOR_PURPLE:
            if (this.pos.getRoomRangeTo(this.hive) > 5) {
              this.delete(true);
              break;
            }
            if (!this.master) {
              let [x, y] = this.pos.getRoomCoorinates();
              x %= 10;
              y %= 10;
              if (4 <= x && x <= 6 && 4 <= y && y <= 6) {
                if (x != 5 || y != 5)
                  this.master = new skMaster(this);
              } else if (x > 0 && y > 0)
                this.master = new annexMaster(this);
            }

            if (this.hive.addAnex(this.pos.roomName) !== OK) {
              if (!this.master)
                this.master = new puppetMaster(this);
              this.acted = false;
            }
            break;
          case COLOR_GREY:
            if (Object.keys(Apiary.hives).length < Game.gcl.level) {
              if (!this.master)
                this.master = new claimerMaster(this);
            } else
              this.delete();
            break;
          case COLOR_WHITE:
            let hiveToBoos = Apiary.hives[this.pos.roomName];
            if (hiveToBoos && this.pos.roomName !== this.hive.roomName
              && (hiveToBoos.stage === 0 || (hiveToBoos.cells.storage && hiveToBoos.cells.storage.storage.store[RESOURCE_ENERGY] < 10000))) {
              hiveToBoos.bassboost = this.hive;
              hiveToBoos.spawOrders = {};
              _.forEach(this.hive.cells, (c) => {
                if (c.master)
                  c.master.waitingForBees = 0;
              });
              if (hiveToBoos.cells.dev && hiveToBoos.cells.dev.master)
                (<bootstrapMaster>hiveToBoos.cells.dev.master).recalculateTargetBee();
            } else
              this.delete();
            break;
        }
        break;
      case COLOR_CYAN:
        this.uniqueFlag();
        if (this.hive.roomName === this.pos.roomName) {
          let cell;
          let type: keyof HivePositions | undefined;
          switch (this.flag.secondaryColor) {
            case COLOR_CYAN:
              type = "hive";
              this.hive.pos = this.pos;
              cell = this.hive.cells.excavation;
              break;
            case COLOR_GREEN:
              type = "spawn";
              cell = this.hive.cells.spawn;
              break;
            case COLOR_YELLOW:
              type = "storage";
              cell = this.hive.cells.storage;
              break;
            case COLOR_GREY:
              type = "lab";
              cell = this.hive.cells.lab;
              break;
          }
          if (cell)
            cell.pos = this.pos;
          if (type)
            Memory.cache.positions[this.hive.roomName][type] = { x: this.pos.x, y: this.pos.y };
        }
        this.delete();
        break;
      case COLOR_WHITE:
        _.forEach(Game.flags, (f) => {
          if (f.color === COLOR_WHITE && f.name !== this.ref && Apiary.orders[f.name])
            Apiary.orders[f.name].delete();
        });
        switch (this.flag.secondaryColor) {
          case COLOR_WHITE:
            let baseRotation: 0 | 1 | 2 | 3 = 0;
            if (this.ref.includes("right"))
              baseRotation = 1;
            else if (this.ref.includes("top"))
              baseRotation = 2;
            else if (this.ref.includes("bottom"))
              baseRotation = 3;

            Apiary.planner.generatePlan(this.pos, baseRotation);
            break;
          case COLOR_ORANGE:
            if (Memory.cache.roomPlanner[this.pos.roomName] && Object.keys(Memory.cache.roomPlanner[this.pos.roomName]).length) {
              Apiary.planner.toActive(this.pos.roomName);
              if (this.hive.shouldRecalc < 3)
                if (this.hive.roomName === this.pos.roomName)
                  this.hive.shouldRecalc = 1;
                else
                  this.hive.shouldRecalc = 2;
            } else
              this.delete();
            break;
          case COLOR_RED:
            if (Game.time % 3 === 0 && Apiary.useBucket) {
              let contr = Game.rooms[this.pos.roomName] && Game.rooms[this.pos.roomName].controller;
              if (contr && (contr.my || contr.reservation && contr.reservation.username === Apiary.username))
                Apiary.planner.resetPlanner(this.pos.roomName);
              Apiary.planner.toActive(this.pos.roomName);
            }
            this.acted = false;
            break;
          case COLOR_GREEN:
            let del: 0 | 1 | 2 = 0;
            for (let name in Apiary.planner.activePlanning) {
              if (Apiary.planner.activePlanning[name].correct !== "ok")
                del = 1;
            }
            if (!del || /^force/.exec(this.ref)) {
              for (let name in Apiary.planner.activePlanning) {
                Apiary.planner.saveActive(name);
                delete Apiary.planner.activePlanning[name];
              }
              if (!Object.keys(Apiary.planner.activePlanning).length)
                del = 2;
            }
            if (del) {
              this.delete();
              if (del > 1)
                this.pos.createFlag(this.ref + "_" + makeId(4), COLOR_WHITE, COLOR_ORANGE);
            }
            break;
          case COLOR_CYAN:
            break;
        }
        break;
      case COLOR_GREY:
        switch (this.flag.secondaryColor) {
          case COLOR_RED:
            this.acted = false;
            if (this.pos.roomName in Game.rooms && this.pos.lookFor(LOOK_STRUCTURES).length === 0)
              this.delete();
            break;
          case COLOR_PURPLE:
            if (!this.master)
              this.master = new puppetMaster(this);
            break;
          case COLOR_GREEN:
            if (!this.master) {
              let master = new pickupMaster(this);
              let regex = /^\d*/.exec(this.ref);
              if (regex && regex[0])
                master.maxSpawns = +regex[0];
              master.targetBeeCount = master.maxSpawns;
              this.master = master;
            }
            break;
          case COLOR_CYAN:
            this.acted = false;
            if (this.pos.roomName === this.hive.roomName && this.hive.cells.lab) {
              if (!Object.keys(this.hive.cells.lab.synthesizeRequests).length) {
                let ans = _.some(this.flag.name.split("_"), (res) => this.hive.cells.lab!.newSynthesizeRequest(<ReactionConstant>res));
                if (!ans && this.hive.cells.lab.time !== Game.time)
                  this.delete();
              }
            } else
              this.delete();
            break;
          case COLOR_YELLOW:
            this.fixedName(prefix.upgrade + this.hive.roomName);
            break;
        }
        break;
      case COLOR_YELLOW:
        if (this.pos.getRoomRangeTo(this.hive) > 5) {
          this.delete(true);
          break;
        }
        if (this.pos.roomName in Game.rooms) {
          let resource: Source | Mineral | undefined;
          switch (this.flag.secondaryColor) {
            case COLOR_YELLOW:
              resource = this.pos.lookFor(LOOK_SOURCES)[0];
              if (resource) {
                if (this.hive.cells.excavation)
                  this.hive.cells.excavation.addResource(resource);
                else if (this.hive.cells.dev)
                  this.hive.cells.dev.addResource(resource);
              } else
                this.delete();
              break;
            case COLOR_CYAN:
              resource = this.pos.lookFor(LOOK_MINERALS)[0];
              if (resource) {
                if (this.hive.cells.excavation)
                  this.hive.cells.excavation.addResource(resource);
              } else
                this.delete();
              break;
          }
        } else
          this.acted = false;
        break;
    }
  }

  // what to do when delete if something neede
  delete(force = false) {
    if (!force && this.flag.memory.repeat && this.flag.memory.repeat > 0) {
      if (!Memory.log.orders)
        Memory.log.orders = {};
      if (LOGGING_CYCLE) Memory.log.orders[this.ref + "_" + this.flag.memory.repeat] = {
        time: Game.time,
        name: this.flag.name,
        pos: this.pos,
        destroyTime: Game.time,
        master: this.master ? true : false,
      }
      this.flag.memory.repeat -= 1;
      if (this.master)
        Apiary.masters[this.master.ref].delete();
      this.acted = false;
      return;
    }

    if (LOGGING_CYCLE) {
      if (!Memory.log.orders)
        Memory.log.orders = {};
      Memory.log.orders[this.ref] = {
        time: Game.time,
        name: this.flag.name,
        pos: this.pos,
        destroyTime: Game.time,
        master: this.master ? true : false,
      }
    }

    if (this.master)
      Apiary.masters[this.master.ref].delete();

    switch (this.flag.color) {
      case COLOR_PURPLE:
        switch (this.flag.secondaryColor) {
          case COLOR_WHITE:
            let hiveBoosted = Apiary.hives[this.pos.roomName];
            if (hiveBoosted) {
              hiveBoosted.bassboost = null;
              if (hiveBoosted.cells.dev && hiveBoosted.cells.dev.master)
                (<bootstrapMaster>hiveBoosted.cells.dev.master).recalculateTargetBee();

              let pos = hiveBoosted.room.controller && hiveBoosted.room.controller.pos;
              if (pos) {
                let newPos = [new RoomPosition(pos.x, pos.y + 1, pos.roomName), new RoomPosition(pos.x, pos.y - 1, pos.roomName)]
                  .filter((p) => p.lookFor(LOOK_FLAGS).length == 0)[0] || new RoomPosition(pos.x, pos.y, pos.roomName);
                newPos.createFlag(prefix.upgrade + hiveBoosted.roomName, COLOR_GREY, COLOR_YELLOW);
              }
            }
            break;
          case COLOR_PURPLE:
            if (!force)
              return;
            break;
        }
        break;
      case COLOR_RED:
        for (const key in Apiary.defenseSwarms)
          if (Apiary.defenseSwarms[key].ref === this.ref)
            delete Apiary.defenseSwarms[key];
        break;
      case COLOR_WHITE:
        if (!_.filter(Apiary.orders, (o) => o.flag.color === COLOR_WHITE && o.ref !== this.ref).length)
          for (let name in Apiary.planner.activePlanning)
            delete Apiary.planner.activePlanning[name];
        break;
    }
    this.flag.remove();
    delete Apiary.orders[this.ref];
  }

  update() {
    this.flag = Game.flags[this.ref];
    if (this.flag.pos.x !== this.pos.x || this.flag.pos.y !== this.pos.y)
      this.acted = false;
    this.pos = this.flag.pos;
    if (!this.acted)
      this.act();
  }

  static checkFlags() {
    for (const name in Game.flags)
      if (!Apiary.orders[name])
        Apiary.orders[name] = new this(Game.flags[name]);
  }

  get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>A${this.acted ? "+" : "-"} M${this.master ? "+" : "-"} ["${this.ref}"]</a>`;
  }
}
