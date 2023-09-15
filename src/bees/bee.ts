import type { Master, MasterParent } from "../beeMasters/_Master";
import { profile } from "../profiler/decorator";
import { beeStates, prefix, setupsNames } from "../static/enums";
import { ProtoBee } from "./protoBee";

@profile
export class Bee extends ProtoBee<Creep> {
  // #region Properties (5)

  public boosted: boolean;
  public lifeTime: number;
  public master: Master<MasterParent> | undefined;
  public pulledPos: RoomPosition | undefined = undefined;
  public workMax: number;

  // #endregion Properties (5)

  // #region Constructors (1)

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

  // #endregion Constructors (1)

  // #region Public Accessors (4)

  public get body() {
    return this.creep.body;
  }

  public get fatigue() {
    return (
      this.creep.fatigue || (this.creep.getActiveBodyparts(MOVE) ? 0 : Infinity)
    );
  }

  public get memory() {
    return this.creep.memory;
  }

  public override get pos() {
    return this.pulledPos || this.creep.pos;
  }

  // #endregion Public Accessors (4)

  // #region Public Static Methods (1)

  public static checkAliveBees() {
    for (const name in Game.creeps) {
      const bee = Apiary.bees[name];
      // need to update version of objects
      if (!bee) Apiary.bees[name] = new Bee(Game.creeps[name]);
      else if (bee.state === beeStates.idle) {
        // F bee is list
      }
    }
  }

  // #endregion Public Static Methods (1)

  // #region Public Methods (20)

  public attack(
    t: Creep | Structure | PowerCreep,
    opt: TravelToOptions = {}
  ): ScreepsReturnCode {
    opt.movingTarget = true;
    const ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.attack(t) : ans;
  }

  public attackController(
    t: StructureController,
    opt?: TravelToOptions
  ): ScreepsReturnCode {
    const ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.attackController(t) : ans;
  }

  public build(t: ConstructionSite, opt?: TravelToOptions): ScreepsReturnCode {
    const ans = this.actionCheck(t.pos, opt, 3);
    if (ans === OK && this.pos.enteranceToRoom) this.goTo(t);
    return ans === OK ? this.creep.build(t) : ans;
  }

  public claimController(
    t: StructureController,
    opt?: TravelToOptions
  ): ScreepsReturnCode {
    const ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.claimController(t) : ans;
  }

  public dismantle(t: Structure, opt: TravelToOptions = {}): ScreepsReturnCode {
    const ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.dismantle(t) : ans;
  }

  public findClosestByHive(masters: Master<MasterParent>[]) {
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

  public findMaster() {
    if (
      this.ref.includes(setupsNames.hauler) ||
      this.ref.includes(setupsNames.depositHauler)
    ) {
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
          _.filter(Apiary.masters, (m) => m.ref.includes(prefix.buildingCell))
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
            (m) => m.ref.includes(prefix.reserve) && "reservationTime" in m
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
    } else if (
      this.ref.includes(setupsNames.defender) ||
      this.ref.includes(setupsNames.knight) ||
      this.ref.includes(setupsNames.archer)
    ) {
      if (
        this.findClosestByHive(
          _.filter(
            Apiary.defenseSwarms,
            (m) => !m.boosts && m.parent.spawned >= m.maxSpawns
          )
        )
      )
        return;
    } else if (this.ref.includes(setupsNames.builder)) {
      if (
        this.findClosestByHive(
          _.filter(Apiary.masters, (m) => m.ref.includes(prefix.buildingCell))
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

  public getActiveBodyParts(partType: BodyPartConstant): number {
    return this.creep.getBodyParts(partType, undefined, true);
  }

  public getBodyParts(
    partType: BodyPartConstant,
    boosted: 1 | 0 | -1 = 0
  ): number {
    return this.creep.getBodyParts(partType, boosted);
  }

  public harvest(
    t: Source | Mineral | Deposit,
    opt?: TravelToOptions
  ): ScreepsReturnCode {
    const ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.harvest(t) : ans;
  }

  public heal(t: Creep | PowerCreep | Bee, opt: TravelToOptions = {}) {
    opt.movingTarget = true;
    if (t instanceof Bee) t = t.creep;
    const ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.heal(t) : ans;
  }

  public pull(
    t: Bee,
    pos: RoomPosition,
    opt: TravelToOptions
  ): ScreepsReturnCode {
    if (!this.pos.isNearTo(t)) {
      // target eneterance
      const tEnt = t.pos.enteranceToRoom;
      // bee enterance
      const bEnt = this.pos.enteranceToRoom;
      if (
        bEnt &&
        tEnt &&
        tEnt.roomName === this.pos.roomName &&
        bEnt.roomName === t.pos.roomName
      ) {
        // wait for ma guy to come to me
        const nonExit = this.pos
          .getOpenPositions()
          .filter((p) => !p.enteranceToRoom && p.getRangeTo(this) === 1)[0];
        // fucks with traveler but it is what it is
        if (nonExit) this.targetPosition = nonExit;
      } else if (!tEnt || tEnt.roomName !== this.pos.roomName) {
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
      // they need to be in the same room to be pulled
      // needs proper test this but this fixed an issue with not pulling near border so yeah
      const anotherExit = this.pos
        .getOpenPositions()
        .filter((p) => p.enteranceToRoom && p.getRangeTo(this) === 1)[0];
      // fucks with traveler but it is what it is
      if (anotherExit) this.targetPosition = anotherExit;
    }
    let ans: ScreepsReturnCode = this.creep.pull(t.creep);
    if (ans === OK) ans = t.creep.move(this.creep);
    if (ans === OK) t.pulledPos = this.creep.pos;
    return ans;
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

  public rangedHeal(t: Creep | PowerCreep | Bee, opt: TravelToOptions = {}) {
    opt.movingTarget = true;
    if (t instanceof Bee) t = t.creep;
    const ans = this.actionCheck(t.pos, opt, 3);
    return ans === OK ? this.creep.rangedHeal(t) : ans;
  }

  public rangedMassAttack(): ScreepsReturnCode {
    return this.creep.rangedMassAttack();
  }

  public repair(t: Structure, opt?: TravelToOptions): ScreepsReturnCode {
    const ans = this.actionCheck(t.pos, opt, 3);
    if (ans === OK && this.pos.enteranceToRoom) this.goTo(t);
    return ans === OK ? this.creep.repair(t) : ans;
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

  public reserveController(
    t: StructureController,
    opt?: TravelToOptions
  ): ScreepsReturnCode {
    const ans = this.actionCheck(t.pos, opt);
    return ans === OK ? this.creep.reserveController(t) : ans;
  }

  public override update() {
    super.update();
    this.pulledPos = undefined;
    this.creep = Game.creeps[this.ref];
    if (!this.master) {
      if (!Apiary.masters[this.creep.memory.refMaster]) this.findMaster();
      if (Apiary.masters[this.creep.memory.refMaster])
        Apiary.masters[this.creep.memory.refMaster].newBee(this);
    }
  }

  public upgradeController(
    t: StructureController,
    opt?: TravelToOptions
  ): ScreepsReturnCode {
    const ans = this.actionCheck(t.pos, opt, 3);
    return ans === OK ? this.creep.upgradeController(t) : ans;
  }

  // #endregion Public Methods (20)
}
