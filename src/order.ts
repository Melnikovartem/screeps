import { hordeMaster } from "./beeMaster/war/horde";
import { downgradeMaster } from "./beeMaster/war/downgrader";
import { drainerMaster } from "./beeMaster/war/drainer";

import { Master } from "./beeMaster/_Master";
import { Hive } from "./Hive";
import { puppetMaster } from "./beeMaster/civil/puppet";
import { profile } from "./profiler/decorator";

import { PRINT_INFO, LOGGING_CYCLE } from "./settings";

@profile
export class Order {
  ref: string;
  flag: Flag;
  pos: RoomPosition;
  destroyTime: number
  master?: Master;

  constructor(flag: Flag) {
    this.ref = flag.name;
    this.flag = flag;
    this.pos = flag.pos;

    this.flag.memory = {
      repeat: this.flag.memory.repeat ? this.flag.memory.repeat : 0,
    }

    this.destroyTime = Game.time + 2000;
    this.getMaster();

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

    if (global.Apiary.hives[this.pos.roomName])
      homeRoom = this.pos.roomName;
    else
      homeRoom = Object.keys(global.Apiary.hives)[Math.floor(Math.random() * Object.keys(global.Apiary.hives).length)];

    _.forEach(Game.map.describeExits(this.pos.roomName), (exit) => {
      if (global.Apiary.hives[<string>exit] && global.Apiary.hives[homeRoom].stage > global.Apiary.hives[<string>exit].stage)
        homeRoom = <string>exit;
    });
    return global.Apiary.hives[homeRoom];
  }

  getMaster() {
    // annex room
    if (this.flag.color == COLOR_RED) {
      if (this.flag.secondaryColor == COLOR_BLUE)
        this.master = new hordeMaster(this.findHive(), this);
      else if (this.flag.secondaryColor == COLOR_PURPLE)
        this.master = new downgradeMaster(this.findHive(), this);
      else if (this.flag.secondaryColor == COLOR_YELLOW)
        this.master = new drainerMaster(this.findHive(), this);
      else if (this.flag.secondaryColor == COLOR_GREY)
        this.master = new puppetMaster(this.findHive(), this.pos.roomName, this);
      else if (this.flag.secondaryColor == COLOR_RED) {
        let newMaster = new hordeMaster(this.findHive(), this);

        if (this.ref.includes("controller"))
          newMaster.tryToDowngrade = true;
        let matches = this.ref.match(/\d+/g);
        if (matches != null) //F?
          newMaster.targetBeeCount = +matches[0];
        else
          newMaster.targetBeeCount = 2;
        newMaster.maxSpawns = newMaster.targetBeeCount * 2;

        this.master = newMaster;
      }
    }
  }

  update(flag: Flag) {
    this.flag = flag;
    this.pos = flag.pos;
    if (!this.master)
      this.getMaster();

    if (this.destroyTime < Game.time) {
      if (this.master)
        delete global.masters[this.master.ref];

      if (this.flag.memory.repeat > 0) {
        if (PRINT_INFO) console.log("repeated" + this.ref);
        this.destroyTime = Game.time + 2000;
        this.flag.memory.repeat -= 1;
        this.getMaster();
      } else {
        if (LOGGING_CYCLE) {
          Memory.log.orders[this.ref].destroyTime = Game.time;
          Memory.log.orders[this.ref].pos = this.flag.pos;
        }
        return 0; //killsig}
      }
    }
    return 1;
  }
}
