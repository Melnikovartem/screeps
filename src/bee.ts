import { Master } from "beeMaster/_Master";

export class Bee {

  master: Master;
  creep: Creep;

  ref: string;

  // time to inherite some shit from Creep

  // for now it will be forever binded
  constructor(creep: Creep) {
    this.creep = creep;
    this.master = global.masters[this.creep.memory.refMaster];

    this.ref = creep.name;

    // not sure weather i should copy all parameters from creep like body and stuff
    global.bees[this.creep.name] = this;
  }

  print(info: any) {
    console.log(Game.time, "!", this.creep.name, "?", info);
  }

  harvest(source: Source): number {
    if (this.creep.pos.isNearTo(source))
      this.creep.harvest(source);
    else
      this.goTo(source);
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

  reserveController(target: StructureController): number {
    if (this.creep.pos.isNearTo(target))
      return this.creep.reserveController(target);
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

  goTo(target: RoomPosition | RoomObject) {
    this.creep.moveTo(target, {
      reusePath: 1,
    });
  }

  /*
    getBodyparts(partType: BodyPartConstant): number {
      return _.filter(this.body, (part: BodyPartDefinition) => part.type == partType).length;
    }
  */
}
