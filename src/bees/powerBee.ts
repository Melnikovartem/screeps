import { prefix } from "../enums";
import { profile } from "../profiler/decorator";

import { ProtoBee } from "./protoBee";
import { NKVDMaster } from "../beeMasters/powerCreeps/nkvd";

import type { Master } from "../beeMasters/_Master";

@profile
export class PowerBee extends ProtoBee<PowerCreep> {
  master: Master | undefined;
  lifeTime: number;

  boosted = false;

  // for now it will be forever binded
  constructor(creep: PowerCreep) {
    super(creep);
    this.lifeTime = POWER_CREEP_LIFE_TIME;
    // not sure weather i should copy all parameters from creep like body and stuff
    Apiary.bees[this.creep.name] = this;
  }

  get memory() {
    return this.creep.memory;
  }

  get powers() {
    return this.creep.powers;
  }

  get shard() {
    return this.creep.shard;
  }

  get fatigue() {
    return 0;
  }

  usePower(pwr: PowerConstant, t?: RoomObject, opt?: TravelToOptions) {
    const pwrInfo = POWER_INFO[pwr];
    const pwrStats = this.powers[pwr];
    if (pwrStats) {
      if (pwrStats.cooldown) return ERR_TIRED;
      else if (
        "ops" in pwrInfo &&
        this.store.getUsedCapacity(RESOURCE_OPS) < pwrInfo.ops
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

  enableRoom(t: StructureController, opt?: TravelToOptions) {
    const ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.enableRoom(t) : ans;
  }

  renew(t: StructurePowerSpawn | StructurePowerBank, opt?: TravelToOptions) {
    const ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.renew(t) : ans;
  }

  update() {
    super.update();
    this.creep = Game.powerCreeps[this.ref];
  }

  static makeMaster(ref: string): ((pb: PowerBee) => Master) | undefined {
    let validCells = _.compact(_.map(Apiary.hives, (h) => h.cells.power!));
    if (ref.includes(prefix.nkvd)) {
      validCells = validCells.filter(
        (c) => c.powerManager === ref && !c.powerManagerBee
      );
      if (validCells.length) return (pb) => new NKVDMaster(validCells[0], pb);
    }
    return undefined;
  }

  static checkBees() {
    for (const name in Game.powerCreeps) {
      const pc = Game.powerCreeps[name];
      if (
        (!pc.shard || pc.shard === Game.shard.name) &&
        !pc.spawnCooldownTime
      ) {
        if (!Apiary.bees[name] && !Apiary.masters[prefix.master + name]) {
          const futureMaster = this.makeMaster(pc.name);
          if (futureMaster) {
            const bee = new PowerBee(pc);
            Apiary.bees[name] = bee;
            bee.master = futureMaster(bee);
          }
        }
      }
    }
  }

  get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.ref}"]</a>`;
  }
}
