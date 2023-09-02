import { KGBMaster } from "beeMasters/powerCreeps/kgb";

import type { Master } from "../beeMasters/_Master";
import { NKVDMaster } from "../beeMasters/powerCreeps/nkvd";
import { profile } from "../profiler/decorator";
import { prefix } from "../static/enums";
import { ProtoBee } from "./protoBee";

@profile
export class PowerBee extends ProtoBee<PowerCreep> {
  // #region Properties (2)

  public lifeTime: number;
  public master: Master | undefined;

  // #endregion Properties (2)

  // #region Constructors (1)

  // for now it will be forever binded
  public constructor(creep: PowerCreep) {
    super(creep);
    this.lifeTime = POWER_CREEP_LIFE_TIME;
    // not sure weather i should copy all parameters from creep like body and stuff
    Apiary.bees[this.creep.name] = this;
  }

  // #endregion Constructors (1)

  // #region Public Accessors (5)

  public get fatigue() {
    return 0;
  }

  public get memory() {
    return this.creep.memory;
  }

  public get powers() {
    return this.creep.powers;
  }

  public get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.ref}"]</a>`;
  }

  public get shard() {
    return this.creep.shard;
  }

  // #endregion Public Accessors (5)

  // #region Public Static Methods (2)

  public static checkAliveBees() {
    for (const name in Game.powerCreeps) {
      const pc = Game.powerCreeps[name];
      if (
        (!pc.shard || pc.shard === Game.shard.name) &&
        !pc.spawnCooldownTime
      ) {
        if (!Apiary.bees[name] && !Apiary.masters[prefix.master + name]) {
          const futureMaster = this.makeMaster(pc);
          if (futureMaster) {
            const bee = new PowerBee(pc);
            Apiary.bees[name] = bee;
            bee.master = futureMaster(bee);
          }
        }
      }
    }
  }

  public static makeMaster(
    pc: PowerCreep
  ): ((pb: PowerBee) => Master) | undefined {
    let validCells = _.compact(_.map(Apiary.hives, (h) => h.cells.power!));
    if (pc.name.includes(prefix.nkvd)) {
      const validCellsExact = validCells.filter(
        (c) => c.powerManager === pc.name && !c.powerManagerBee
      );
      if (validCellsExact.length) validCells = validCellsExact;
      else {
        const factoryPower =
          PWR_OPERATE_FACTORY in pc.powers &&
          pc.powers[PWR_OPERATE_FACTORY].level;
        validCells = validCells.filter(
          (c) =>
            c.powerManager === undefined &&
            c.hive.cells.factory &&
            (c.hive.cells.factory.factory.level === factoryPower ||
              c.hive.cells.factory.factory.level === undefined)
        );
      }
      if (validCells.length) return (pb) => new NKVDMaster(validCells[0], pb);
    } else if (pc.name.includes(prefix.kgb)) {
      // no spawning for KGB on shard3 cause no wars there :/
      if (Game.cpu.limit <= 20) return;
      if (pc.pos) {
        const validCellsExact = validCells.filter(
          (h) => h.pos.roomName === pc.pos.roomName
        );
        if (validCellsExact.length) validCells = validCellsExact;
      }
      if (validCells.length) return (pb) => new KGBMaster(validCells[0], pb);
    }
    return undefined;
  }

  // #endregion Public Static Methods (2)

  // #region Public Methods (4)

  public enableRoom(t: StructureController, opt?: TravelToOptions) {
    const ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.enableRoom(t) : ans;
  }

  public renew(
    t: StructurePowerSpawn | StructurePowerBank,
    opt?: TravelToOptions
  ) {
    const ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.renew(t) : ans;
  }

  public update() {
    super.update();
    this.creep = Game.powerCreeps[this.ref];
  }

  public usePower(pwr: PowerConstant, t?: RoomObject, opt?: TravelToOptions) {
    const pwrInfo = POWER_INFO[pwr];
    const pwrStats = this.powers[pwr];
    if (pwrStats) {
      if (pwrStats.cooldown) return ERR_TIRED;
      else if (
        "ops" in pwrInfo &&
        this.store.getUsedCapacity(RESOURCE_OPS) <
          (Array.isArray(pwrInfo.ops)
            ? pwrInfo.ops[pwrStats.level]
            : pwrInfo.ops)
      )
        return ERR_NOT_ENOUGH_RESOURCES;
    } else return ERR_NOT_FOUND;
    let ans: ScreepsReturnCode = OK;
    if (t) {
      let range;
      if ("range" in pwrInfo) range = pwrInfo.range;
      ans = this.actionCheck(t.pos, opt, range);
    }
    return ans === OK ? this.creep.usePower(pwr, t) : ans;
  }

  // #endregion Public Methods (4)
}
