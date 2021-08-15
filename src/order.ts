import { hordeMaster } from "./beeMaster/war/horde";
import { downgradeMaster } from "./beeMaster/war/downgrader";
import { drainerMaster } from "./beeMaster/war/drainer";

import { ReactionConstant } from "./cells/base/laboratoryCell";

import { Master } from "./beeMaster/_Master";
import { Hive } from "./Hive";
import { puppetMaster } from "./beeMaster/civil/puppet";
import { profile } from "./profiler/decorator";

import { UPDATE_EACH_TICK, PRINT_INFO, LOGGING_CYCLE } from "./settings";

@profile
export class Order {
  ref: string;
  flag: Flag;
  pos: RoomPosition;
  destroyTime: number
  master?: Master;
  checkTime: number;

  constructor(flag: Flag) {
    this.ref = flag.name;
    this.flag = flag;
    this.pos = flag.pos;
    this.checkTime = 1;

    this.flag.memory = {
      repeat: this.flag.memory.repeat ? this.flag.memory.repeat : 0,
    }

    this.destroyTime = -1;
    this.actUpon();

    if (LOGGING_CYCLE) Memory.log.orders[this.ref] = {
      time: Game.time,
      color: this.flag.color,
      secondaryColor: this.flag.color,
      name: this.flag.name,
      repeat: this.flag.memory.repeat,
      pos: this.flag.pos,
      destroyTime: -1,
    }
  }

  findHive(): Hive {
    let homeRoom: string;

    if (Apiary.hives[this.pos.roomName])
      homeRoom = this.pos.roomName;
    else
      homeRoom = Object.keys(Apiary.hives)[Math.floor(Math.random() * Object.keys(Apiary.hives).length)];

    _.forEach(Game.map.describeExits(this.pos.roomName), (exit) => {
      if (Apiary.hives[<string>exit] && Apiary.hives[homeRoom].stage > Apiary.hives[<string>exit].stage)
        homeRoom = <string>exit;
    });
    return Apiary.hives[homeRoom];
  }

  actUpon() {
    // annex room
    if (this.flag.color == COLOR_RED) {
      if (this.flag.secondaryColor == COLOR_BLUE)
        this.master = new hordeMaster(this.findHive(), this);
      else if (this.flag.secondaryColor == COLOR_PURPLE)
        this.master = new downgradeMaster(this.findHive(), this);
      else if (this.flag.secondaryColor == COLOR_YELLOW)
        this.master = new drainerMaster(this.findHive(), this);
      else if (this.flag.secondaryColor == COLOR_GREY) {
        let newMaster = new puppetMaster(this.findHive(), this.pos.roomName, this);
        newMaster.force = true;
        this.master = newMaster;
      }
      else if (this.flag.secondaryColor == COLOR_RED) {
        let newMaster = new hordeMaster(this.findHive(), this);
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
      this.checkTime = 50;
      if (this.flag.secondaryColor == COLOR_PURPLE)
        this.findHive().addAnex(this.pos.roomName);
    } else if (this.flag.color == COLOR_CYAN) {
      this.checkTime = 200;
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
      }
    } else if (this.flag.color == COLOR_GREY) {
      this.checkTime = 50;
      if (this.flag.secondaryColor == COLOR_RED) {
        if (this.pos.roomName in Game.rooms && this.pos.lookFor(LOOK_STRUCTURES).length == 0)
          this.destroyTime = Game.time;
      }
    }
  }

  update(flag: Flag) {
    if (UPDATE_EACH_TICK || Game.time % this.checkTime == 0) {
      this.flag = flag;
      this.pos = flag.pos;
      if (!this.master)
        this.actUpon();
    }

    if (this.destroyTime != -1 && this.destroyTime <= Game.time) {
      if (this.master)
        delete Apiary.masters[this.master.ref];

      if (this.flag.memory.repeat > 0) {
        if (PRINT_INFO) console.log("repeated" + this.ref);
        this.destroyTime = Game.time + 2000;
        this.flag.memory.repeat -= 1;
        this.actUpon();
      } else {
        if (LOGGING_CYCLE) {
          Memory.log.orders[this.ref].destroyTime = Game.time;
          Memory.log.orders[this.ref].pos = this.flag.pos;
        }
        return 0; //killsig
      }
    }
    return 1;
  }
}
