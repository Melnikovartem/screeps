import { hordeMaster } from "./beeMaster/war/horde";
import { downgradeMaster } from "./beeMaster/war/downgrader";
import { drainerMaster } from "./beeMaster/war/drainer";

import { Master } from "./beeMaster/_Master";
import { Hive } from "./Hive";
import { puppetMaster } from "./beeMaster/civil/puppet";

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

    this.destroyTime = Game.time + 2000;
    this.getMaster();
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
        this.master = new puppetMaster(this.findHive(), this.pos.roomName)
      else if (this.flag.secondaryColor == COLOR_RED) {
        let horde = new hordeMaster(this.findHive(), this);

        if (this.ref.includes("controller"))
          horde.tryToDowngrade = true;
        let matches = this.ref.match(/\d+/g);
        if (matches != null) //F?
          horde.targetBeeCount = <number><unknown>matches[0];
        else
          horde.targetBeeCount = 2;
        horde.maxSpawns = horde.targetBeeCount * 2;

        this.master = horde;
      }
    }
  }

  update(flag: Flag) {
    this.flag = flag;
    this.pos = flag.pos;
    if (!this.master)
      this.getMaster();

    if (this.destroyTime < Game.time) {
      this.flag.remove();
      if (this.master)
        delete global.masters[this.master.ref];
      return 0; //killsig
    }
    return 1;
  }
}
