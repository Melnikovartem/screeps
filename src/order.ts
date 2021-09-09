import { hordeMaster } from "./beeMasters/war/horde";
import { downgradeMaster } from "./beeMasters/war/downgrader";
import { dismantlerMaster } from "./beeMasters/war/dismantler";
import { healerWaiterMaster } from "./beeMasters/war/healerWaiter";
import { dupletMaster } from "./beeMasters/war/duplet";
import { squadMaster } from "./beeMasters/war/squad";

import { ReactionConstant } from "./cells/stage1/laboratoryCell";

import { Master } from "./beeMasters/_Master";
import { Hive } from "./Hive";
import { puppetMaster } from "./beeMasters/civil/puppet";
import { annexMaster } from "./beeMasters/civil/annexer";
import { claimerMaster } from "./beeMasters/civil/claimer";
import { bootstrapMaster } from "./beeMasters/economy/bootstrap";

import { profile } from "./profiler/decorator";
import { LOGGING_CYCLE } from "./settings";

@profile
export class Order {
  ref: string;
  flag: Flag;
  pos: RoomPosition;
  destroyTime: number
  master?: Master;
  hive: Hive;
  acted: boolean = false;

  constructor(flag: Flag) {
    this.ref = flag.name;
    this.flag = flag;
    this.pos = flag.pos;

    if (this.flag.memory.hive && Apiary.hives[this.flag.memory.hive])
      this.hive = Apiary.hives[this.flag.memory.hive];
    else {
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
          filter = (h) => h.stage >= 0;
          break;
      }

      this.hive = this.findHive(filter);
    }
    this.flag.memory = { hive: this.hive.roomName };
    this.destroyTime = -1;
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
      let newDist = this.pos.getRoomRangeTo(h)
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
        if (f.color === this.flag.color && f.secondaryColor == this.flag.secondaryColor
          && (!local || f.pos.roomName == this.pos.roomName) && f.name != this.ref && Apiary.orders[f.name])
          Apiary.orders[f.name].delete();
      });
      return OK;
    }
    return ERR_NOT_FOUND;
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
              this.master = new hordeMaster(this);
              break;
            case COLOR_PURPLE:
              this.master = new downgradeMaster(this);
              break;
            case COLOR_YELLOW:
              this.master = new dismantlerMaster(this);
              break;
            case COLOR_GREEN:
              this.master = new healerWaiterMaster(this);
              break;
            case COLOR_RED:
              this.master = new dupletMaster(this);
              break;
            case COLOR_ORANGE:
              this.master = new squadMaster(this);
              break;
            case COLOR_WHITE:
              // COLOR_WHITE to mark surrendered rooms
              break;
          }
        break;
      case COLOR_PURPLE:
        switch (this.flag.secondaryColor) {
          case COLOR_PURPLE:
            this.hive = this.hive;
            if (!this.master)
              this.master = new annexMaster(this);
            if (this.hive.addAnex(this.pos.roomName) !== OK)
              this.acted = false;
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
          let prefix = "";
          switch (this.flag.secondaryColor) {
            case COLOR_CYAN:
              this.hive.pos = this.pos;
              if (this.hive.cells.excavation)
                this.hive.cells.excavation.pos = this.pos;
              prefix = "chillZone";
              break;
            case COLOR_GREEN:
              if (this.hive)
                this.hive.cells.spawn.pos = this.pos;
              prefix = "queen";
              break;
            case COLOR_YELLOW:
              if (this.hive.cells.storage)
                this.hive.cells.storage.pos = this.pos;
              prefix = "man";
              break;
            case COLOR_BROWN:
              if (this.hive.cells.lab) {
                this.hive.cells.lab.pos = this.pos;
                let sum = 0;
                _.forEach(this.flag.name.split("_"), (res) => {
                  sum += this.hive.cells.lab!.newSynthesizeRequest(<ReactionConstant>res);
                });
                if (sum === 0)
                  prefix = "lab";
              }
              break;
          }
          if (prefix != "" && this.ref != prefix + this.hive.roomName) {
            this.pos.createFlag(prefix + this.hive.roomName, this.flag.color, this.flag.secondaryColor);
            this.delete();
          }
        } else
          this.delete();
        // this.delete(); if need to get rid of tone of flags
        break;
      case COLOR_WHITE:
        switch (this.flag.secondaryColor) {
          case COLOR_WHITE:
            this.uniqueFlag(false);
            Apiary.planner.generatePlan(this.pos);
            break;
          case COLOR_ORANGE:
            if (Memory.cache.roomPlanner[this.pos.roomName] && Object.keys(Memory.cache.roomPlanner[this.pos.roomName]).length) {
              this.uniqueFlag();
              Apiary.planner.toActive(this.pos.roomName);
            } else
              this.delete();
            break;
          case COLOR_RED:
            if (Game.time % 3 === 0 && Apiary.useBucket) {
              let contr = Game.rooms[this.pos.roomName] && Game.rooms[this.pos.roomName].controller;
              if (contr && (contr.my || contr.reservation && contr.reservation.username == Apiary.username))
                Apiary.planner.resetPlanner(this.pos.roomName);
              this.uniqueFlag();
              Apiary.planner.toActive(this.pos.roomName);
            }
            this.acted = false;
            break;
        }
        break;
      case COLOR_GREY:
        switch (this.flag.secondaryColor) {
          case COLOR_RED:
            if (this.pos.roomName in Game.rooms && this.pos.lookFor(LOOK_STRUCTURES).length === 0)
              this.delete();
            break;
          case COLOR_YELLOW:
            if (!this.master)
              this.master = new puppetMaster(this);
            break;
        }
        break;
      case COLOR_YELLOW:
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
  delete() {
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
            }
            break;
        }
        break;
      case COLOR_RED:
        for (const key in Apiary.defenseSwarms)
          if (Apiary.defenseSwarms[key].ref === this.ref)
            delete Apiary.defenseSwarms[key];
        break;
      case COLOR_WHITE:
        switch (this.flag.secondaryColor) {
          case COLOR_WHITE:
            for (let name in Apiary.planner.activePlanning)
              delete Apiary.planner.activePlanning[name];
            break;
          case COLOR_ORANGE: case COLOR_RED:
            delete Apiary.planner.activePlanning[this.pos.roomName];
            break;
        }
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

    if (this.destroyTime !== -1 && this.destroyTime <= Game.time) {
      if (this.flag.memory.repeat && this.flag.memory.repeat > 0) {
        if (!Memory.log.orders)
          Memory.log.orders = {};
        if (LOGGING_CYCLE) Memory.log.orders[this.ref + "_" + this.flag.memory.repeat] = {
          time: Game.time,
          name: this.flag.name,
          pos: this.pos,
          destroyTime: Game.time,
          master: this.master ? true : false,
        }
        this.destroyTime = -1;
        this.flag.memory.repeat -= 1;
        if (this.master)
          Apiary.masters[this.master.ref].delete();
        this.act();
      } else
        this.delete();
    }
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
