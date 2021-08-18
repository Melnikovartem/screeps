import { hordeMaster } from "./beeMaster/war/horde";
import { downgradeMaster } from "./beeMaster/war/downgrader";
import { drainerMaster } from "./beeMaster/war/drainer";
import { dupletMaster } from "./beeMaster/war/duplet";
import { squadMaster } from "./beeMaster/war/squad";

import { ReactionConstant } from "./cells/stage1/laboratoryCell";

import { Master } from "./beeMaster/_Master";
import { Hive } from "./Hive";
import { puppetMaster } from "./beeMaster/civil/puppet";
import { annexMaster } from "./beeMaster/civil/annexer";
import { claimerMaster } from "./beeMaster/civil/claimer";
import { bootstrapMaster } from "./beeMaster/economy/bootstrap";

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
    else
      this.hive = this.findHive(1);

    this.flag.memory = {
      repeat: this.flag.memory.repeat ? this.flag.memory.repeat : 0,
      hive: this.hive.roomName,
    };

    this.destroyTime = -1;
    if (LOGGING_CYCLE) Memory.log.orders[this.ref] = {
      time: Game.time,
      name: this.flag.name,
      pos: this.flag.pos,
      destroyTime: -1,
      acted: false,
    }
  }

  findHive(stage?: 0 | 1 | 2): Hive {
    if (Apiary.hives[this.pos.roomName] && Apiary.hives[this.pos.roomName].stage >= (stage ? stage : 0))
      return Apiary.hives[this.pos.roomName];

    for (const k in Game.map.describeExits(this.pos.roomName)) {
      let exit = Game.map.describeExits(this.pos.roomName)[<ExitKey>k];
      if (exit && Apiary.hives[exit] && Apiary.hives[exit].stage >= (stage ? stage : 0))
        return Apiary.hives[exit];
    }

    // well time to look for faraway boys
    let validHives = _.filter(Apiary.hives, (h) => h.stage >= (stage ? stage : 0));
    if (!validHives.length)
      validHives = _.map(Apiary.hives, (h) => h);

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

  act() {
    // dont forget to this.acted = true otherwise you will get new master each tick
    if (this.flag.color == COLOR_RED) {
      this.acted = true;
      if (!this.master) {
        if (this.flag.secondaryColor == COLOR_BLUE) {
          let newMaster = new hordeMaster(this);
          if (this.ref.includes("controller"))
            newMaster.tryToDowngrade = true;
          let matches = this.ref.match(/\d+/g);
          if (matches != null && /^defend_/.exec(this.ref) == null)
            newMaster.targetBeeCount = +matches[0];
          else
            newMaster.targetBeeCount = 1;
          this.master = newMaster;
        } else if (this.flag.secondaryColor == COLOR_PURPLE)
          this.master = new downgradeMaster(this);
        else if (this.flag.secondaryColor == COLOR_YELLOW)
          this.master = new drainerMaster(this);
        else if (this.flag.secondaryColor == COLOR_GREY)
          this.master = new puppetMaster(this);
        else if (this.flag.secondaryColor == COLOR_RED)
          this.master = new dupletMaster(this);
        else if (this.flag.secondaryColor == COLOR_ORANGE)
          this.master = new squadMaster(this);

      }
    } else if (this.flag.color == COLOR_PURPLE) {
      if (this.flag.secondaryColor == COLOR_PURPLE) {
        if (!this.master)
          this.master = new annexMaster(this);
        if (this.hive.addAnex(this.pos.roomName) == OK)
          this.acted = true;
      } else if (this.flag.secondaryColor == COLOR_GREY) {
        if (Object.keys(Apiary.hives).length < Game.gcl.level) {
          this.acted = true;
          if (!this.master)
            this.master = new claimerMaster(this);
        } else
          this.delete();
      }
      else if (this.flag.secondaryColor == COLOR_WHITE) {
        this.acted = true;
        let hiveToBoos = Apiary.hives[this.pos.roomName];
        if (hiveToBoos && hiveToBoos.stage == 0 && this.pos.roomName != this.hive.roomName) {
          hiveToBoos.bassboost = this.hive;
          hiveToBoos.spawOrders = {};
          if (hiveToBoos.cells.dev && hiveToBoos.cells.dev.beeMaster) {
            hiveToBoos.cells.dev.beeMaster.waitingForBees = 0;
            (<bootstrapMaster>hiveToBoos.cells.dev.beeMaster).recalculateTargetBee();
          }
        } else
          this.delete();
      }
    } else if (this.flag.color == COLOR_CYAN) {
      this.acted = true;
      let hive = Apiary.hives[this.pos.roomName]
      if (hive) {
        if (this.flag.secondaryColor == COLOR_CYAN) {
          hive.pos = this.pos;
          if (hive.cells.excavation)
            hive.cells.excavation.pos = this.pos;
        } else if (this.flag.secondaryColor == COLOR_GREEN) {
          if (hive)
            hive.cells.spawn.pos = this.pos;
        } else if (this.flag.secondaryColor == COLOR_YELLOW) {
          if (hive.cells.storage)
            hive.cells.storage.pos = this.pos;
        } else if (this.flag.secondaryColor == COLOR_BROWN) {
          if (hive.cells.lab)
            if (!hive.cells.lab.currentRequest) {
              let sum = 0;
              _.forEach(this.flag.name.split("_"), (res) => {
                sum += hive.cells.lab!.newSynthesizeRequest(<ReactionConstant>res);
              });
              if (sum == 0)
                this.delete();
            }
        }
      } else
        this.delete();
    } else if (this.flag.color == COLOR_GREY) {
      if (this.flag.secondaryColor == COLOR_RED) {
        if (this.pos.roomName in Game.rooms && this.pos.lookFor(LOOK_STRUCTURES).length == 0)
          this.delete();
      }
    } else if (this.flag.color == COLOR_YELLOW) {
      if (this.pos.roomName in Game.rooms) {
        this.acted = true;
        if (this.flag.secondaryColor == COLOR_YELLOW) {
          let resource: Source | undefined = this.pos.lookFor(LOOK_SOURCES)[0];
          if (resource) {
            if (this.hive.cells.excavation)
              this.hive.cells.excavation.addResource(resource);
            else if (this.hive.cells.dev)
              this.hive.cells.dev.addResource(resource)
          } else
            this.delete();
        } else if (this.flag.secondaryColor == COLOR_CYAN) {
          let resource: Mineral | undefined = this.pos.lookFor(LOOK_MINERALS)[0];
          if (resource) {
            if (this.hive.cells.excavation)
              this.hive.cells.excavation.addResource(resource)
          } else
            this.delete();
        }
      }
    }
  }

  // what to do when delete if something neede
  delete() {
    if (LOGGING_CYCLE) {
      Memory.log.orders[this.ref].destroyTime = Game.time;
      Memory.log.orders[this.ref].pos = this.pos;
    }

    if (this.master)
      Apiary.masters[this.master.ref].delete();

    if (this.flag.color == COLOR_PURPLE) {
      if (this.flag.secondaryColor == COLOR_WHITE) {
        let hiveBoosted = Apiary.hives[this.pos.roomName];
        if (hiveBoosted) {
          hiveBoosted.bassboost = null;
          if (hiveBoosted.cells.dev && hiveBoosted.cells.dev.beeMaster)
            (<bootstrapMaster>hiveBoosted.cells.dev.beeMaster).recalculateTargetBee();
        }
      }
    }
    this.flag.remove();
    delete Apiary.orders[this.ref];
  }

  update() {
    this.flag = Game.flags[this.ref];
    if (this.flag.pos.x != this.pos.x || this.flag.pos.y != this.pos.y)
      this.acted = false;
    this.pos = this.flag.pos;
    if (!this.acted)
      this.act();

    if (this.destroyTime != -1 && this.destroyTime <= Game.time) {
      if (this.flag.memory.repeat > 0) {
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
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>[Order ${this.ref} ${this.acted ? "+" : "-"}]</a>`;
  }
}
