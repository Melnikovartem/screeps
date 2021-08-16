import { hordeMaster } from "./beeMaster/war/horde";
import { downgradeMaster } from "./beeMaster/war/downgrader";
import { drainerMaster } from "./beeMaster/war/drainer";

import { ReactionConstant } from "./cells/base/laboratoryCell";

import { Master } from "./beeMaster/_Master";
import { Hive } from "./Hive";
import { puppetMaster } from "./beeMaster/civil/puppet";
import { annexMaster } from "./beeMaster/civil/annexer";
import { claimerMaster } from "./beeMaster/civil/claimer";

import { profile } from "./profiler/decorator";
import { PRINT_INFO, LOGGING_CYCLE } from "./settings";

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
      color: this.flag.color,
      secondaryColor: this.flag.color,
      name: this.flag.name,
      repeat: this.flag.memory.repeat,
      pos: this.flag.pos,
      destroyTime: -1,
    }

    this.act();
  }

  findHive(stage?: 0 | 1 | 2): Hive {
    if (Apiary.hives[this.pos.roomName] && Apiary.hives[this.pos.roomName].stage >= (stage ? stage : 0))
      return Apiary.hives[this.pos.roomName];

    for (let k in Game.map.describeExits(this.pos.roomName)) {
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
    // annex room
    if (this.flag.color == COLOR_RED) {
      if (this.flag.secondaryColor == COLOR_BLUE)
        this.master = new hordeMaster(this);
      else if (this.flag.secondaryColor == COLOR_PURPLE)
        this.master = new downgradeMaster(this);
      else if (this.flag.secondaryColor == COLOR_YELLOW)
        this.master = new drainerMaster(this);
      else if (this.flag.secondaryColor == COLOR_GREY) {
        let newMaster = new puppetMaster(this);
        newMaster.force = true;
        this.master = newMaster;
      }
      else if (this.flag.secondaryColor == COLOR_RED) {
        let newMaster = new hordeMaster(this);
        if (this.ref.includes("controller"))
          newMaster.tryToDowngrade = true;
        let matches = this.ref.match(/\d+/g);
        if (matches != null) //F?
          newMaster.targetBeeCount = +matches[0];
        else
          newMaster.targetBeeCount = 1;
        newMaster.priority = 4;
        this.master = newMaster;
      }
    } else if (this.flag.color == COLOR_PURPLE) {
      if (this.flag.secondaryColor == COLOR_PURPLE) {
        if (this.hive.room.energyCapacityAvailable >= 650)
          this.master = new annexMaster(this);
        if (this.hive.addAnex(this.pos.roomName) == OK)
          this.acted = true;
      } else if (this.flag.secondaryColor == COLOR_GREY)
        this.master = new claimerMaster(this);
      else if (this.flag.secondaryColor == COLOR_WHITE) {
        this.acted = true;
        if (this.pos.roomName in Apiary.hives && Apiary.hives[this.pos.roomName].stage == 0 && this.pos.roomName != this.hive.roomName)
          Apiary.hives[this.pos.roomName].bassboost = this.hive;
        else
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
              _.forEach(this.flag.name.split("-"), (res) => {
                let ans = hive.cells.lab.newSynthesizeRequest(<ReactionConstant>res);
                if (PRINT_INFO) console.log(`new Reqest for ${res}: ${ans}`);
              });
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
      Memory.log.orders[this.ref].pos = this.flag.pos;
    }
    if (this.master)
      delete Apiary.masters[this.master.ref];
    this.flag.remove();
    delete Apiary.orders[this.ref];
  }

  update(flag: Flag) {
    if (flag.pos.x != this.pos.x || flag.pos.y != this.pos.y)
      this.acted = false;
    this.flag = flag;
    this.pos = flag.pos;
    // either act based or master based order
    if (!this.acted && !this.master)
      this.act();

    if (this.destroyTime != -1 && this.destroyTime <= Game.time) {
      if (this.flag.memory.repeat > 0) {
        if (PRINT_INFO) console.log("repeated" + this.ref);
        this.destroyTime = -1;
        this.flag.memory.repeat -= 1;
        this.act();
      } else
        this.delete();
    }
  }
}
