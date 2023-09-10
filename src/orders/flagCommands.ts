import type { Hive } from "hive/hive";
import { profile } from "profiler/decorator";
import { hiveStates } from "static/enums";

import { actAnnex, deleteAnnex } from "./flags-annex";
import { actBattle } from "./flags-battle";
import { actCivil } from "./flags-civil";
import { actPlanner, deletePlanner } from "./flags-planner";
import { actUtilsActions, actUtilsPositions } from "./orders-utils";
import { SWARM_MASTER } from "./swarm-nums";

// remove flag after time
const FLAG_INVALIDATE_TIME = 10;

@profile
export class FlagCommand {
  // #region Properties (5)

  public acted: boolean = false;
  public createTime = Game.time;
  public flag: Flag;
  public hive: Hive;
  public prevpos: string = "";

  // #endregion Properties (5)

  // #region Constructors (1)

  public constructor(flag: Flag) {
    this.flag = flag;

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
    Apiary.flags[this.ref] = this;
  }

  // #endregion Constructors (1)

  // #region Public Accessors (6)

  public get color() {
    return this.flag.color;
  }

  public get hiveName(): string {
    return this.hive.roomName;
  }

  public get pos() {
    return this.flag.pos;
  }

  public get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.ref}"]</a>`;
  }

  public get ref() {
    return this.flag.name;
  }

  public get secondaryColor() {
    return this.flag.secondaryColor;
  }

  // #endregion Public Accessors (6)

  // #region Public Static Methods (1)

  public static checkFlags() {
    for (const name in Game.flags)
      if (!Apiary.flags[name]) new this(Game.flags[name]);
  }

  // #endregion Public Static Methods (1)

  // #region Public Methods (4)

  /** creates master. dont forget about extra info */
  public createSwarm(type: SWARM_MASTER) {
    if (Apiary.orders[this.ref]) {
      console.log(
        `ERROR: DUPLICATE ${SWARM_MASTER[type].constructor.name} ORDER FOR ${this.print} NOT CREATED`
      );
      return;
    }
    const order = this.hive.createSwarm(this.ref, this.pos, type);
    console.log(
      `OK: ${SWARM_MASTER[type].constructor.name} ORDER FOR ${this.print} CREATED`
    );
    return order;
  }

  // what to do when delete if something neede
  public delete() {
    switch (this.color) {
      case COLOR_PURPLE:
        deleteAnnex(this);
        break;
      case COLOR_WHITE:
        deletePlanner(this);
        break;
    }
    this.flag.remove();
    delete Apiary.flags[this.ref];
  }

  public fixedName(name: string) {
    if (this.ref !== name && this.pos.roomName in Game.rooms) {
      if (!(name in Game.flags)) {
        this.pos.createFlag(name, this.color, this.secondaryColor);
        // if (typeof ans === "string") Game.flags[ans].memory = this.memory;
      }
      this.delete();
      return false;
    }
    return true;
  }

  public update() {
    this.flag = Game.flags[this.ref];
    this.acted = this.acted && this.prevpos === this.pos.to_str;
    this.prevpos = this.pos.to_str;
    if (!this.acted) this.act();
    if (this.acted && this.createTime + FLAG_INVALIDATE_TIME <= Game.time)
      this.delete();
  }

  // #endregion Public Methods (4)

  // #region Private Methods (2)

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
        switch (this.secondaryColor) {
          case COLOR_YELLOW:
            this.createSwarm(SWARM_MASTER.containerbuilder);
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

  // #endregion Private Methods (2)
}
