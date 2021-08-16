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

  print(...info: any) {
    console.log(Game.time, "!", this.creep.name, "?", info);
  }

  attack(target: Creep | Structure | PowerCreep): number {
    if (this.creep.pos.isNearTo(target))
      return this.creep.attack(target);
    else
      this.goTo(target);
    return ERR_NOT_IN_RANGE;
  }

  heal(target: Creep | PowerCreep | Bee) {
    if (target instanceof Bee)
      target = target.creep;
    if (this.creep.pos.isNearTo(target))
      return this.creep.heal(target);
    else
      this.goTo(target);
    return ERR_NOT_IN_RANGE;
  }

  rangedHeal(target: Creep | PowerCreep | Bee) {
    if (target instanceof Bee)
      target = target.creep;
    if (this.creep.pos.getRangeTo(target.pos) <= 3)
      return this.creep.rangedHeal(target);
    else
      this.goTo(target);
    return ERR_NOT_IN_RANGE;
  }

  harvest(target: Source | Mineral): number {
    if (this.creep.pos.isNearTo(target))
      return this.creep.harvest(target);
    else
      this.goTo(target);
    return ERR_NOT_IN_RANGE;
  }

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

  build(target: ConstructionSite): number {
    if (this.creep.pos.getRangeTo(target.pos) <= 3)
      return this.creep.build(target);
    else
      this.goTo(target);
    return ERR_NOT_IN_RANGE;
  }

  repair(target: Structure): number {
    if (this.creep.pos.getRangeTo(target.pos) <= 3)
      return this.creep.repair(target);
    else
      this.goTo(target);
    return ERR_NOT_IN_RANGE;
  }

  upgradeController(target: StructureController): number {
    if (this.creep.pos.getRangeTo(target.pos) <= 3)
      return this.creep.upgradeController(target);
    else
      this.goTo(target);
    return ERR_NOT_IN_RANGE;
  }

  reserveController(target: StructureController): number {
    if (this.creep.pos.isNearTo(target))
      return this.creep.reserveController(target);
    else
      this.goTo(target);
    return ERR_NOT_IN_RANGE;
  }

  claimController(target: StructureController): number {
    if (this.creep.pos.isNearTo(target))
      return this.creep.claimController(target);
    else
      this.goTo(target);
    return ERR_NOT_IN_RANGE;
  }

  attackController(target: StructureController): number {
    if (this.pos.isNearTo(target))
      return this.creep.attackController(target);
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
}
