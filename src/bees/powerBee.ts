import { PowerCell } from "cells/stage2/powerCell";

import type { Master } from "../beeMasters/_Master";
import { NKVDMaster } from "../beeMasters/powerCreeps/nkvd";
import { prefix } from "../enums";
import { profile } from "../profiler/decorator";
import { ProtoBee } from "./protoBee";

@profile
export class PowerBee extends ProtoBee<PowerCreep> {
  public master: Master | undefined;
  public lifeTime: number;

  public boosted = false;

  // for now it will be forever binded
  public constructor(creep: PowerCreep) {
    super(creep);
    this.lifeTime = POWER_CREEP_LIFE_TIME;
    // not sure weather i should copy all parameters from creep like body and stuff
    Apiary.bees[this.creep.name] = this;
  }

  public get memory() {
    return this.creep.memory;
  }

  public get powers() {
    return this.creep.powers;
  }

  public get shard() {
    return this.creep.shard;
  }

  public get fatigue() {
    return 0;
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

  public static makeMaster(
    pc: PowerCreep
  ): ((pb: PowerBee) => Master) | undefined {
    let validCells = _.compact(_.map(Apiary.hives, (h) => h.cells.power!));
    if (pc.name.includes(prefix.nkvd)) {
      validCells = validCells.filter(
        (c) =>
          (c.powerManager === pc.name || c.powerManager === undefined) &&
          !c.powerManagerBee
      );
      if (validCells.length && PWR_OPERATE_FACTORY in pc.powers) {
        validCells = validCells.filter(
          (c) =>
            c.hive.cells.factory &&
            c.hive.cells.factory.factory.level ===
              pc.powers[PWR_OPERATE_FACTORY].level
        );
      }
      if (validCells.length) return (pb) => new NKVDMaster(validCells[0], pb);
    }
    return undefined;
  }

  public static checkBees() {
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

  public get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.ref}"]</a>`;
  }
}
