import type { SwarmMaster } from "beeMasters/_SwarmMaster";
import { ContainerBuilderMaster } from "beeMasters/civil/containerBuilder";
import type { Hive } from "hive/hive";
import { profile } from "profiler/decorator";
import { hiveStates } from "static/enums";

import { actAnnex, deleteAnnex } from "./orders-annex";
import { actBattle } from "./orders-battle";
import { actCivil } from "./orders-civil";
import { actUtilsActions, actUtilsPositions } from "./orders-utils";
import { SwarmOrder } from "./swarmOrder";

@profile
export class FlagOrder extends SwarmOrder {
  public flag: Flag;
  public master?: SwarmMaster;
  public hive: Hive;
  public acted: boolean = false;
  public prevpos: string = "";

  public get ref() {
    return this.flag.name;
  }

  public constructor(flag: Flag) {
    super();
    this.flag = flag;

    if (this.memory.hive) {
      this.hive = Apiary.hives[this.memory.hive];
      if (!this.hive) {
        this.flag.remove();
        return;
      }
    } else {
      let filter: (h: Hive) => boolean = (h) => h.phase >= 2;
      let parsed: RegExpExecArray | null;
      switch (this.color) {
        case COLOR_CYAN:
          filter = (h) => h.roomName === this.pos.roomName && h.phase >= 1;
          break;
        case COLOR_PURPLE:
          if (this.secondaryColor === COLOR_WHITE)
            filter = (h) =>
              h.roomName !== this.pos.roomName &&
              h.state === hiveStates.economy &&
              h.phase > 0;
          if (this.secondaryColor !== COLOR_PURPLE) break;
          parsed = /_room_([WE][0-9]+[NS][0-9]+)$/.exec(this.ref);
          if (parsed) {
            filter = (h) => h.roomName === parsed![1];
            break;
          }
          filter = () => true;
          break;
        case COLOR_WHITE:
        case COLOR_YELLOW:
        case COLOR_GREY:
        case COLOR_BLUE:
          filter = () => true;
          break;
        case COLOR_RED:
        case COLOR_ORANGE:
          parsed = /_room_([WE][0-9]+[NS][0-9]+)$/.exec(this.ref);
          if (parsed) filter = (h) => h.roomName === parsed![1];
          break;
      }
      this.hive = this.findHive(filter);
    }
    const newMemory: FlagMemory = {
      hive: this.hiveName,
      info: this.memory.info,
      extraPos: this.memory.extraPos,
      extraInfo: this.memory.extraInfo,
    };
    this.flag.memory = newMemory;
    Apiary.orders[this.ref] = this;
  }

  public get memory() {
    return this.flag.memory;
  }

  private findHive(filter: (h: Hive) => boolean = () => true): Hive {
    if (
      Apiary.hives[this.pos.roomName] &&
      filter(Apiary.hives[this.pos.roomName])
    )
      return Apiary.hives[this.pos.roomName];

    for (const k in Game.map.describeExits(this.pos.roomName)) {
      const exit = Game.map.describeExits(this.pos.roomName)[k as ExitKey];
      if (exit && Apiary.hives[exit] && filter(Apiary.hives[exit]))
        return Apiary.hives[exit];
    }

    // well time to look for faraway boys
    let validHives = _.filter(Apiary.hives, filter);
    if (!validHives.length) validHives = _.map(Apiary.hives, (h) => h);

    let bestHive = validHives.pop()!; // if i don't have a single hive wtf am i doing
    let dist = this.pos.getRoomRangeTo(bestHive);
    _.forEach(validHives, (h) => {
      const newDist = this.pos.getRoomRangeTo(h);
      if (newDist < dist) {
        dist = newDist;
        bestHive = h;
      }
    });
    return bestHive;
  }

  public fixedName(name: string) {
    if (this.ref !== name && this.pos.roomName in Game.rooms) {
      if (!(name in Game.flags)) {
        const ans = this.pos.createFlag(name, this.color, this.secondaryColor);
        if (typeof ans === "string") Game.flags[ans].memory = this.memory;
      }
      this.delete();
      return false;
    }
    return true;
  }

  private act() {
    this.acted = true;
    switch (this.color) {
      case COLOR_RED:
        actBattle(this);
        break;
      case COLOR_PURPLE:
        actAnnex(this);
        break;
      case COLOR_CYAN:
        actUtilsPositions(this);
        break;
      case COLOR_WHITE:
        actPlanner(this);
        break;
      case COLOR_ORANGE:
        actCivil(this);
        break;
      case COLOR_BLUE:
        if (
          this.hiveName !== this.pos.roomName &&
          this.secondaryColor !== COLOR_YELLOW
        ) {
          this.delete();
          break;
        }
        switch (this.secondaryColor) {
          case COLOR_YELLOW:
            this.master = new ContainerBuilderMaster(this);
            break;
        }
        break;
      case COLOR_GREY:
        actUtilsActions(this);
        break;
      case COLOR_YELLOW:
        this.delete();
        break;
    }
  }

  // what to do when delete if something neede
  public delete() {
    Apiary.logger.reportOrder(this);

    switch (this.color) {
      case COLOR_PURPLE:
        deleteAnnex(this);
        break;
      case COLOR_WHITE:
        deletePlanner(this);
        break;
    }

    if (this.master) this.master.delete();
    this.master = undefined;

    this.flag.remove();
    delete Apiary.orders[this.ref];
  }

  public get pos() {
    return this.flag.pos;
  }

  public get color() {
    return this.flag.color;
  }

  public get secondaryColor() {
    return this.flag.secondaryColor;
  }

  public update() {
    this.flag = Game.flags[this.ref];
    this.acted = this.acted && this.prevpos === this.pos.to_str;
    this.prevpos = this.pos.to_str;
    if (!this.acted) this.act();
  }

  public static checkFlags() {
    for (const name in Game.flags)
      if (!Apiary.orders[name]) new this(Game.flags[name]);
  }

  public get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.ref}"]</a>`;
  }

  public get hiveName(): string {
    return this.hive.roomName;
  }
}
