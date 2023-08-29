import type { Master } from "../beeMasters/_Master";
import { profile } from "../profiler/decorator";
import { beeStates, prefix, setupsNames } from "../static/enums";
import { ProtoBee } from "./protoBee";

@profile
export class Bee extends ProtoBee<Creep> {
  public master: Master | undefined;

  public boosted: boolean;
  public lifeTime: number;

  public workMax: number;

  public pulledPos: RoomPosition | undefined = undefined;

  // for now it will be forever binded
  public constructor(creep: Creep) {
    super(creep);
    this.creep = creep;
    this.boosted = !!this.body.filter((b) => b.boost).length;
    this.lifeTime = this.getBodyParts(CLAIM)
      ? CREEP_CLAIM_LIFE_TIME
      : CREEP_LIFE_TIME;
    this.workMax = this.getBodyParts(WORK);
    Apiary.bees[this.creep.name] = this;
  }

  public get pos() {
    return this.pulledPos || this.creep.pos;
  }

  public get body() {
    return this.creep.body;
  }

  public get memory() {
    return this.creep.memory;
  }

  public get fatigue() {
    return (
      this.creep.fatigue || (this.creep.getActiveBodyparts(MOVE) ? 0 : Infinity)
    );
  }

  public update() {
    super.update();
    this.pulledPos = undefined;
    this.creep = Game.creeps[this.ref];
    if (!this.master) {
      if (!Apiary.masters[this.creep.memory.refMaster]) this.findMaster();
      if (Apiary.masters[this.creep.memory.refMaster]) {
        this.master = Apiary.masters[this.creep.memory.refMaster];
        this.master.newBee(this);
      }
    }
  }

  public findMaster() {
    if (this.ref.includes(setupsNames.hauler)) {
      if (
        this.findClosestByHive(
          _.filter(Apiary.masters, (m) => m.ref.includes(prefix.excavationCell))
        )
      )
        return;
    } else if (this.ref.includes(setupsNames.bootstrap)) {
      if (
        this.findClosestByHive(
          _.filter(Apiary.masters, (m) =>
            m.ref.includes(prefix.developmentCell)
          )
        )
      )
        return;
      if (
        this.findClosestByHive(
          _.filter(Apiary.masters, (m) => m.ref.includes(prefix.builder))
        )
      )
        return;
    } else if (this.ref.includes(setupsNames.claimer)) {
      if (
        this.findClosestByHive(
          _.filter(Apiary.masters, (m) => m.ref.includes(prefix.claim))
        )
      )
        return;
      if (
        this.findClosestByHive(
          _.filter(
            Apiary.masters,
            (m) => m.ref.includes(prefix.annex) && "reservationTime" in m
          )
        )
      )
        return;
      if (
        this.findClosestByHive(
          _.filter(
            Apiary.masters,
            (m) => m.activeBees.length < 1 && m.ref.includes("downgrade")
          )
        )
      )
        return;
    } else if (this.ref.includes(setupsNames.defender)) {
      if (
        this.findClosestByHive(
          _.filter(
            Apiary.defenseSwarms,
            (m) => !m.boosts || m.spawned === m.maxSpawns
          )
        )
      )
        return;
    } else if (this.ref.includes(setupsNames.knight)) {
      if (
        this.findClosestByHive(
          _.filter(Apiary.masters, (m) => m.ref.includes("harass"))
        )
      )
        return;
      if (
        this.findClosestByHive(
          _.filter(
            Apiary.defenseSwarms,
            (m) => !m.boosts || m.spawned === m.maxSpawns
          )
        )
      )
        return;
    } else if (this.ref.includes(setupsNames.builder)) {
      if (
        this.findClosestByHive(
          _.filter(Apiary.masters, (m) => m.ref.includes(prefix.builder))
        )
      )
        return;
    } else if (
      this.ref.includes(setupsNames.healer) ||
      this.ref.includes(setupsNames.dismantler)
    ) {
      if (
        this.findClosestByHive(
          _.filter(Apiary.masters, (m) => m.ref.includes("dismantle"))
        )
      )
        return;
    } else if (this.ref.includes(setupsNames.upgrader)) {
      if (
        this.findClosestByHive(
          _.filter(Apiary.masters, (m) => m.ref.includes(prefix.upgradeCell))
        )
      )
        return;
    } else if (this.ref.includes(setupsNames.minerEnergy)) {
      if (
        this.findClosestByHive(
          _.filter(Apiary.masters, (m) => m.ref.includes(prefix.resourceCells))
        )
      )
        return;
    }
    return "";
  }

  public findClosestByHive(masters: Master[]) {
    if (!masters.length) return false;
    const ans = masters.reduce((prev, curr) => {
      let diffDist =
        curr.hive.pos.getRoomRangeTo(this) - prev.hive.pos.getRoomRangeTo(this);
      if (diffDist === 0)
        diffDist =
          prev.targetBeeCount -
          prev.beesAmount -
          (curr.targetBeeCount - curr.beesAmount);
      return diffDist < 0 ? curr : prev;
    });
    if (ans.hive.pos.getRoomRangeTo(this) * 25 > this.ticksToLive) return false;
    this.memory.refMaster = ans.ref;
    return true;
  }

  public getBodyParts(
    partType: BodyPartConstant,
    boosted: 1 | 0 | -1 = 0
  ): number {
    return this.creep.getBodyParts(partType, boosted);
  }

  public getActiveBodyParts(partType: BodyPartConstant): number {
    return this.creep.getBodyParts(partType, undefined, true);
  }

  public pull(
    t: Bee,
    pos: RoomPosition,
    opt: TravelToOptions
  ): ScreepsReturnCode {
    if (!this.pos.isNearTo(t)) {
      const tEnt = t.pos.enteranceToRoom;
      if (!tEnt || tEnt.roomName !== this.pos.roomName) {
        if (opt.obstacles) opt.obstacles.push({ pos: t.pos });
        else opt.obstacles = [{ pos: t.pos }];
        this.goTo(t, opt);
      }
      return ERR_TIRED;
    }
    this.goTo(this.pos.equal(pos) ? t.pos : pos, opt);
    if (
      this.targetPosition &&
      this.targetPosition.roomName !== this.pos.roomName &&
      this.pos.enteranceToRoom
    ) {
      const anotherExit = this.pos
        .getOpenPositions(true)
        .filter((p) => p.enteranceToRoom && p.getRangeTo(this) === 1)[0];
      if (anotherExit) this.targetPosition = anotherExit;
    }
    const ans = this.creep.pull(t.creep) || t.creep.move(this.creep);
    if (ans === OK) t.pulledPos = this.creep.pos;
    return ans;
  }

  public attack(
    t: Creep | Structure | PowerCreep,
    opt: TravelToOptions = {}
  ): ScreepsReturnCode {
    opt.movingTarget = true;
    const ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.attack(t) : ans;
  }

  public rangedAttack(
    t: Creep | Structure | PowerCreep,
    opt: TravelToOptions = {}
  ): ScreepsReturnCode {
    opt.movingTarget = true;
    const ans = this.actionCheck(t.pos, opt, 3);
    if (t && this.pos.getRangeTo(t) <= 1 && "owner" in t)
      return this.creep.rangedMassAttack();
    return ans === OK ? this.creep.rangedAttack(t) : ans;
  }

  public rangedMassAttack(): ScreepsReturnCode {
    return this.creep.rangedMassAttack();
  }

  public heal(t: Creep | PowerCreep | Bee, opt: TravelToOptions = {}) {
    opt.movingTarget = true;
    if (t instanceof Bee) t = t.creep;
    const ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.heal(t) : ans;
  }

  public rangedHeal(t: Creep | PowerCreep | Bee, opt: TravelToOptions = {}) {
    opt.movingTarget = true;
    if (t instanceof Bee) t = t.creep;
    const ans = this.actionCheck(t.pos, opt, 3);
    return ans === OK ? this.creep.rangedHeal(t) : ans;
  }

  public dismantle(t: Structure, opt: TravelToOptions = {}): ScreepsReturnCode {
    const ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.dismantle(t) : ans;
  }

  public harvest(
    t: Source | Mineral | Deposit,
    opt?: TravelToOptions
  ): ScreepsReturnCode {
    const ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.harvest(t) : ans;
  }

  public build(t: ConstructionSite, opt?: TravelToOptions): ScreepsReturnCode {
    const ans = this.actionCheck(t.pos, opt, 3);
    if (ans === OK && this.pos.enteranceToRoom) this.goTo(t);
    return ans === OK ? this.creep.build(t) : ans;
  }

  public repair(t: Structure, opt?: TravelToOptions): ScreepsReturnCode {
    const ans = this.actionCheck(t.pos, opt, 3);
    if (ans === OK && this.pos.enteranceToRoom) this.goTo(t);
    return ans === OK ? this.creep.repair(t) : ans;
  }

  public upgradeController(
    t: StructureController,
    opt?: TravelToOptions
  ): ScreepsReturnCode {
    const ans = this.actionCheck(t.pos, opt, 3);
    return ans === OK ? this.creep.upgradeController(t) : ans;
  }

  public reserveController(
    t: StructureController,
    opt?: TravelToOptions
  ): ScreepsReturnCode {
    const ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.reserveController(t) : ans;
  }

  public claimController(
    t: StructureController,
    opt?: TravelToOptions
  ): ScreepsReturnCode {
    const ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.claimController(t) : ans;
  }

  public attackController(
    t: StructureController,
    opt?: TravelToOptions
  ): ScreepsReturnCode {
    const ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.attackController(t) : ans;
  }

  public repairRoadOnMove(
    ans: ScreepsReturnCode = ERR_NOT_IN_RANGE
  ): ScreepsReturnCode {
    if (ans === ERR_NOT_IN_RANGE) {
      const road = _.filter(
        this.pos.lookFor(LOOK_STRUCTURES),
        (s) => s.hits < s.hitsMax && s.structureType === STRUCTURE_ROAD
      )[0];
      if (road) return this.repair(road);
    }
    return ans;
  }

  public static checkBees() {
    for (const name in Game.creeps) {
      const bee = Apiary.bees[name];
      if (!bee) Apiary.bees[name] = new Bee(Game.creeps[name]);
      else if (bee.state === beeStates.idle) {
        // F bee is list
      }
    }
  }

  public get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>["${this.ref}"]</a>`;
  }
}
