import { Master } from "beeMaster/_Master";
import { profile } from "./profiler/decorator";

@profile
export class Bee {

  master: Master;
  creep: Creep;

  ref: string;
  pos: RoomPosition;
  store: Store<ResourceConstant, false>;

  reusePath: number = 3;
  lifeTime: number = CREEP_LIFE_TIME;

  // for now it will be forever binded
  constructor(creep: Creep) {
    this.creep = creep;
    this.master = Apiary.masters[this.creep.memory.refMaster];

    this.ref = creep.name;
    this.pos = creep.pos;
    this.store = creep.store;

    if (creep.getBodyparts(CLAIM))
      this.lifeTime = CREEP_CLAIM_LIFE_TIME;

    // not sure weather i should copy all parameters from creep like body and stuff
    Apiary.bees[this.creep.name] = this;
  }

  update() {
    this.creep = Game.creeps[this.ref];
    this.pos = this.creep.pos;
    this.store = this.creep.store;
  }

  // for future: could path to open position near object for targets that require isNearTo
  // but is it worh in terms of CPU?

  actionWrap<Obj extends RoomObject | RoomPosition>(target: Obj, action: () => number, range?: number): number {
    if (this.creep.pos.inRangeTo(target, range ? range : 1))
      return action();
    else
      this.goTo(target);
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

  // aliases from creep

  transfer(target: Structure, resourceType: ResourceConstant, amount?: number): number {
    if (this.creep.pos.isNearTo(target))
      return this.creep.transfer(target, resourceType, amount);
    else
      this.goTo(target);
    return ERR_NOT_IN_RANGE;
  }

  withdraw(target: Structure, resourceType: ResourceConstant, amount?: number): number {
    if (this.creep.pos.isNearTo(target))
      return this.creep.withdraw(target, resourceType, amount);
    else
      this.goTo(target);
    return ERR_NOT_IN_RANGE;
  }

  attack(t: Creep | Structure | PowerCreep): number {
    return this.actionWrap(t, () => this.creep.attack(t));
  }

  heal(t: Creep | PowerCreep | Bee) {
    if (t instanceof Bee)
      t = t.creep;
    return this.actionWrap(t, () => this.creep.heal(<Creep | PowerCreep>t));
  }

  rangedHeal(t: Creep | PowerCreep | Bee) {
    if (t instanceof Bee)
      t = t.creep;
    return this.actionWrap(t, () => this.creep.rangedHeal(<Creep | PowerCreep>t), 3);
  }

  harvest(t: Source | Mineral): number {
    return this.actionWrap(t, () => this.creep.harvest(t));
  }


  build(t: ConstructionSite): number {
    return this.actionWrap(t, () => this.creep.build(t));
  }

  repair(t: Structure): number {
    return this.actionWrap(t, () => this.creep.repair(t), 3);
  }

  upgradeController(t: StructureController): number {
    return this.actionWrap(t, () => this.creep.upgradeController(t), 3);
  }

  reserveController(t: StructureController): number {
    return this.actionWrap(t, () => this.creep.reserveController(t));
  }

  claimController(t: StructureController): number {
    return this.actionWrap(t, () => this.creep.claimController(t));
  }

  attackController(t: StructureController): number {
    return this.actionWrap(t, () => this.creep.attackController(t));
  }

  get print(): string {
    return `<a href=#!/room/${Game.shard.name}/${this.pos.roomName}>[${this.ref}]</a>`;
  }
}
