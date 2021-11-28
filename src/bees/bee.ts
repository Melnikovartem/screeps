import { beeStates, prefix } from "../enums";
import { profile } from "../profiler/decorator";
import { setupsNames } from "../enums";
import { ProtoBee } from "./protoBee";
import type { Master } from "../beeMasters/_Master";

@profile
export class Bee extends ProtoBee<Creep> {
  master: Master | undefined;

  boosted = false;
  lifeTime: number;

  pulledPos: RoomPosition | undefined = undefined;

  // for now it will be forever binded
  constructor(creep: Creep) {
    super(creep);
    this.creep = creep;
    this.boosted = !!this.body.filter(b => b.boost).length;
    this.lifeTime = this.getBodyParts(CLAIM) ? CREEP_CLAIM_LIFE_TIME : CREEP_LIFE_TIME;
    // not sure weather i should copy all parameters from creep like body and stuff
    Apiary.bees[this.creep.name] = this;
  }

  get pos() {
    return this.pulledPos || this.creep.pos;
  }

  get body() {
    return this.creep.body;
  }

  get memory() {
    return this.creep.memory;
  }

  get fatigue() {
    return this.creep.fatigue || (this.creep.getActiveBodyparts(MOVE) ? 0 : Infinity);
  }

  update() {
    super.update();
    this.pulledPos = undefined;
    this.creep = Game.creeps[this.ref];
    if (!this.master) {
      if (!Apiary.masters[this.creep.memory.refMaster])
        this.creep.memory.refMaster = this.findMaster();
      if (Apiary.masters[this.creep.memory.refMaster]) {
        this.master = Apiary.masters[this.creep.memory.refMaster];
        this.master.newBee(this);
      }
    }
  }

  findMaster() {
    if (this.ref.includes(setupsNames.hauler)) {
      let refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.ref.includes(prefix.excavationCell))); // && m.beesAmount <= m.targetBeeCount + 2));
      if (refMaster)
        return refMaster;
    } else if (this.ref.includes(setupsNames.bootstrap)) {
      let refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.ref.includes(prefix.developmentCell)));
      if (refMaster)
        return refMaster;
      refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.ref.includes(prefix.builder)));
      if (refMaster)
        return refMaster;
    } else if (this.ref.includes(setupsNames.claimer)) {
      let refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.ref.includes(prefix.claim)));
      if (refMaster)
        return refMaster;
      refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.ref.includes(prefix.annex)));
      if (refMaster)
        return refMaster;
      refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.activeBees.length < 1 && m.ref.includes("downgrade")));
      if (refMaster)
        return refMaster;
    } else if (this.ref.includes(setupsNames.defender)) {
      let refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.ref.includes(prefix.def)));
      if (refMaster)
        return refMaster;
      /* refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.ref.includes(prefix.defenseCell)));
      if (refMaster)
        return refMaster;*/
    } else if (this.ref.includes(setupsNames.knight)) {
      let refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.activeBees.length < 1 && m.ref.includes("harass")));
      if (refMaster)
        return refMaster;
      refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.ref.includes("harass")));
      if (refMaster)
        return refMaster;
      refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.ref.includes(prefix.def)));
      if (refMaster)
        return refMaster;
    } else if (this.ref.includes(setupsNames.builder)) {
      let refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.ref.includes(prefix.builder)));
      if (refMaster)
        return refMaster;
    } else if (this.ref.includes(setupsNames.healer) || this.ref.includes(setupsNames.dismantler)) {
      let refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.ref.includes("dismantle")));
      if (refMaster)
        return refMaster;
    }
    /* else if (this.ref.includes(setupsNames.miner)) {
      let refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.beesAmount < 1 && m.ref.includes(prefix.resourceCells)));
      if (refMaster)
        return refMaster;
    } */
    /* else if (this.ref.includes(setupsNames.healer) || this.ref.includes(setupsNames.dismantler)) {
      let refMaster = this.findClosestByHive(_.filter(Apiary.masters, m => m.ref.includes("dismantle")));
      if (refMaster)
        return refMaster;
    }
    }*/
    return this.creep.memory.refMaster === undefined ? "" : this.creep.memory.refMaster;
  }

  findClosestByHive(masters: Master[]) {
    if (!masters.length)
      return null;
    let ans = masters.reduce((prev, curr) => {
      let ans = curr.hive.pos.getRoomRangeTo(this) - prev.hive.pos.getRoomRangeTo(this);
      if (ans === 0)
        ans = (prev.targetBeeCount - prev.beesAmount) - (curr.targetBeeCount - curr.beesAmount);
      return ans < 0 ? curr : prev
    });
    if (ans.hive.pos.getRoomRangeTo(this) * 25 > this.ticksToLive)
      return null;
    return ans.ref;
  }

  getBodyParts(partType: BodyPartConstant, boosted: 1 | 0 | -1 = 0): number {
    return this.creep.getBodyParts(partType, boosted);
  }

  getActiveBodyParts(partType: BodyPartConstant): number {
    return this.creep.getBodyParts(partType, undefined, true);
  }

  pull(t: Bee, pos: RoomPosition, opt: TravelToOptions): ScreepsReturnCode {
    if (!this.pos.isNearTo(t)) {
      let tEnt = t.pos.getEnteranceToRoom();
      if (!tEnt || tEnt.roomName !== this.pos.roomName) {
        if (opt.obstacles)
          opt.obstacles.push({ pos: t.pos })
        else
          opt.obstacles = [{ pos: t.pos }];
        this.goTo(t, opt);
      }
      return ERR_TIRED;
    }
    this.goTo(this.pos.equal(pos) ? t.pos : pos, opt);
    if (this.targetPosition && this.targetPosition.roomName !== this.pos.roomName && this.pos.getEnteranceToRoom()) {
      let anotherExit = this.pos.getOpenPositions(true).filter(p => p.getEnteranceToRoom() && p.getRangeTo(this) === 1)[0];
      if (anotherExit)
        this.targetPosition = anotherExit;
    }
    let ans = this.creep.pull(t.creep) || t.creep.move(this.creep);
    if (ans === OK)
      t.pulledPos = this.creep.pos;
    return ans;
  }

  attack(t: Creep | Structure | PowerCreep, opt: TravelToOptions = {}): ScreepsReturnCode {
    opt.movingTarget = true;
    let ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.attack(t) : ans;
  }

  rangedAttack(t: Creep | Structure | PowerCreep, opt: TravelToOptions = {}): ScreepsReturnCode {
    opt.movingTarget = true;
    let ans = this.actionCheck(t.pos, opt, 3);
    if (t && this.pos.getRangeTo(t) <= 1 && "owner" in t)
      return this.creep.rangedMassAttack();
    return ans === OK ? this.creep.rangedAttack(t) : ans;
  }

  rangedMassAttack(): ScreepsReturnCode {
    return this.creep.rangedMassAttack();
  }

  heal(t: Creep | PowerCreep | Bee, opt: TravelToOptions = {}) {
    opt.movingTarget = true;
    if (t instanceof Bee)
      t = t.creep;
    let ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.heal(t) : ans;
  }

  rangedHeal(t: Creep | PowerCreep | Bee, opt: TravelToOptions = {}) {
    opt.movingTarget = true;
    if (t instanceof Bee)
      t = t.creep;
    let ans = this.actionCheck(t.pos, opt, 3);
    return ans === OK ? this.creep.rangedHeal(t) : ans;
  }

  dismantle(t: Structure, opt: TravelToOptions = {}): ScreepsReturnCode {
    let ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.dismantle(t) : ans;
  }

  harvest(t: Source | Mineral | Deposit, opt?: TravelToOptions): ScreepsReturnCode {
    let ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.harvest(t) : ans;
  }

  build(t: ConstructionSite, opt?: TravelToOptions): ScreepsReturnCode {
    let ans = this.actionCheck(t.pos, opt, 3);
    if (ans === OK && this.pos.getEnteranceToRoom())
      this.goTo(t);
    return ans === OK ? this.creep.build(t) : ans;
  }

  repair(t: Structure, opt?: TravelToOptions): ScreepsReturnCode {
    let ans = this.actionCheck(t.pos, opt, 3);
    if (ans === OK && this.pos.getEnteranceToRoom())
      this.goTo(t);
    return ans === OK ? this.creep.repair(t) : ans;
  }

  upgradeController(t: StructureController, opt?: TravelToOptions): ScreepsReturnCode {
    let ans = this.actionCheck(t.pos, opt, 3);
    return ans === OK ? this.creep.upgradeController(t) : ans;
  }

  reserveController(t: StructureController, opt?: TravelToOptions): ScreepsReturnCode {
    let ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.reserveController(t) : ans;
  }

  claimController(t: StructureController, opt?: TravelToOptions): ScreepsReturnCode {
    let ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.claimController(t) : ans;
  }

  attackController(t: StructureController, opt?: TravelToOptions): ScreepsReturnCode {
    let ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.attackController(t) : ans;
  }

  repairRoadOnMove(ans: ScreepsReturnCode = ERR_NOT_IN_RANGE): ScreepsReturnCode {
    if (ans === ERR_NOT_IN_RANGE) {
      let road = _.filter(this.pos.lookFor(LOOK_STRUCTURES), s => s.hits < s.hitsMax && s.structureType === STRUCTURE_ROAD)[0];
      if (road)
        return this.repair(road);
    }
    return ans;
  }

  static checkBees() {
    for (const name in Game.creeps) {
      let bee = Apiary.bees[name];
      if (!bee)
        Apiary.bees[name] = new Bee(Game.creeps[name]);
      else if (bee.state === beeStates.idle) {
        // F bee is list
      }
    }
  }

  get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.ref}"]</a>`;
  }
}
