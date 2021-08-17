import { Master, states } from "beeMaster/_Master";
import { profile } from "./profiler/decorator";

@profile
export class Bee {

  master: Master | undefined;
  creep: Creep;

  ref: string;
  pos: RoomPosition;
  store: Store<ResourceConstant, false>;
  memory: CreepMemory;

  reusePath: number = 3;
  lifeTime: number = CREEP_LIFE_TIME;

  // target caching and states to have some tools to work with in masters
  state: states = states.idle;
  target: string | null = null;

  // for now it will be forever binded
  constructor(creep: Creep) {
    this.creep = creep;

    this.ref = creep.name;
    this.pos = creep.pos;
    this.store = creep.store;
    this.memory = creep.memory;

    if (creep.getBodyparts(CLAIM))
      this.lifeTime = CREEP_CLAIM_LIFE_TIME;

    // not sure weather i should copy all parameters from creep like body and stuff
    Apiary.bees[this.creep.name] = this;
  }

  update() {
    this.creep = Game.creeps[this.ref];
    this.pos = this.creep.pos;
    this.store = this.creep.store;
    this.memory = this.creep.memory;
    if (!this.master && Apiary.masters[this.creep.memory.refMaster]) {
      this.master = Apiary.masters[this.creep.memory.refMaster];
      this.master.newBee(this);
    }
  }

  // for future: could path to open position near object for targets that require isNearTo
  // but is it worh in terms of CPU?

  actionWrap<Obj extends RoomObject | RoomPosition | undefined>(target: Obj, action: () => number, opt: TravelToOptions = {}, range: number = 1): number {
    if (!target)
      return ERR_NOT_FOUND;
    if (this.creep.pos.inRangeTo(target!, range))
      return action();
    else {
      opt.range = range;
      this.goTo(target!, opt);
    }
    return ERR_NOT_IN_RANGE;
  }

  goRest(pos: RoomPosition, opt?: TravelToOptions): number {
    if ((this.pos.x != pos.x || this.pos.y != pos.y) && (!this.pos.isNearTo(pos) || pos.isFree()) || this.pos.roomName != pos.roomName)
      this.goTo(pos, opt);
    else
      return OK;
    return ERR_NOT_IN_RANGE;
  }

  goToRoom(roomName: string, opt?: TravelToOptions): number {
    return this.goTo(new RoomPosition(25, 25, roomName), opt);
  }

  goTo(target: RoomPosition | RoomObject, opt?: TravelToOptions): number {
    return this.creep.travelTo(target, opt);
  }

  getBodyparts(partType: BodyPartConstant): number {
    return _.filter(this.creep.body, (part: BodyPartDefinition) => part.type == partType).length;
  }

  transfer(t: Structure | undefined, resourceType: ResourceConstant, amount?: number, opt?: TravelToOptions): number {
    return this.actionWrap(t, () => this.creep.transfer(<Structure>t, resourceType, amount), opt);
  }

  withdraw(t: Structure | undefined, resourceType: ResourceConstant, amount?: number, opt?: TravelToOptions): number {
    return this.actionWrap(t, () => this.creep.withdraw(<Structure>t, resourceType, amount), opt);
  }

  attack(t: Creep | Structure | PowerCreep | undefined, opt?: TravelToOptions): number {
    return this.actionWrap(t, () => this.creep.attack(<Creep | Structure | PowerCreep>t), opt);
  }

  heal(t: Creep | PowerCreep | Bee | undefined, opt?: TravelToOptions) {
    if (t instanceof Bee)
      t = t.creep;
    return this.actionWrap(t, () => this.creep.heal(<Creep | PowerCreep>t), opt);
  }

  rangedHeal(t: Creep | PowerCreep | Bee | undefined, opt?: TravelToOptions) {
    if (t instanceof Bee)
      t = t.creep;
    return this.actionWrap(t, () => this.creep.rangedHeal(<Creep | PowerCreep>t), opt, 3);
  }

  harvest(t: Source | Mineral | undefined, opt?: TravelToOptions): number {
    return this.actionWrap(t, () => this.creep.harvest(<Source | Mineral>t), opt);
  }


  build(t: ConstructionSite | undefined, opt?: TravelToOptions): number {
    return this.actionWrap(t, () => this.creep.build(<ConstructionSite>t), opt);
  }

  repair(t: Structure | undefined, opt?: TravelToOptions): number {
    return this.actionWrap(t, () => this.creep.repair(<Structure>t), opt, 3);
  }

  upgradeController(t: StructureController | undefined, opt?: TravelToOptions): number {
    return this.actionWrap(t, () => this.creep.upgradeController(<StructureController>t), opt, 3);
  }

  reserveController(t: StructureController | undefined, opt?: TravelToOptions): number {
    return this.actionWrap(t, () => this.creep.reserveController(<StructureController>t), opt);
  }

  claimController(t: StructureController | undefined, opt?: TravelToOptions): number {
    return this.actionWrap(t, () => this.creep.claimController(<StructureController>t), opt);
  }

  attackController(t: StructureController | undefined, opt?: TravelToOptions): number {
    return this.actionWrap(t, () => this.creep.attackController(<StructureController>t), opt);
  }

  static checkBees() {
    // after all the masters where created and retrived if it was needed
    for (const name in Game.creeps) {
      if (!Apiary.bees[name]) {
        let creep = Game.creeps[name];
        if (Apiary.masters[creep.memory.refMaster]) {
          Apiary.bees[creep.name] = new Bee(creep);
          Apiary.masters[creep.memory.refMaster].newBee(Apiary.bees[creep.name]);
        } else if (/^masterDevelopmentCell/.exec(creep.memory.refMaster)) {
          let randomMaster = Object.keys(Apiary.masters)[Math.floor(Math.random() * Object.keys(Apiary.masters).length)];
          creep.memory.refMaster = randomMaster;
          Apiary.bees[creep.name] = new Bee(creep);
          Apiary.masters[creep.memory.refMaster].newBee(Apiary.bees[creep.name]);
        }
        // idk what to do if i lost a master to the bee. I guess the bee is just FUCKED for now
      }
    }
  }

  get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>[${this.ref}]</a>`;
  }
}
