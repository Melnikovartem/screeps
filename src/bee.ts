import { Master } from "beeMaster/_Master";

export class Bee {

  master: Master;
  creep: Creep;

  ref: string;

  reusePath: number = 3;
  lifeTime: number = CREEP_LIFE_TIME;

  // for now it will be forever binded
  constructor(creep: Creep) {
    this.creep = creep;
    this.master = global.masters[this.creep.memory.refMaster];

    this.ref = creep.name;

    if (creep.getBodyparts(CLAIM))
      this.lifeTime = CREEP_CLAIM_LIFE_TIME;

    // not sure weather i should copy all parameters from creep like body and stuff
    global.bees[this.creep.name] = this;
  }

  // for future: could path to open position near object for targets that require isNearTo
  // but is it worh in terms of CPU?

  print(info: any) {
    console.log(Game.time, "!", this.creep.name, "?", info);
  }

  attack(target: Creep | Structure | PowerCreep): number {
    if (this.creep.pos.isNearTo(target))
      return this.creep.attack(target);
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

  attackController(target: StructureController): number {
    if (this.creep.pos.isNearTo(target))
      return this.creep.attackController(target);
    else
      this.goTo(target);
    return ERR_NOT_IN_RANGE;
  }

  goTo(target: RoomPosition | RoomObject): number {
    return this.creep.travelTo(target, {});
  }

  goToRoom(roomName: string): number {
    return this.goTo(new RoomPosition(25, 25, roomName))
  }

  /*
    getBodyparts(partType: BodyPartConstant): number {
      return _.filter(this.body, (part: BodyPartDefinition) => part.type == partType).length;
    }
  */
}
