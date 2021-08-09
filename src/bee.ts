import { Master } from "beeMaster/_Master";

export class Bee {

  master: Master;
  creep: Creep;

  ref: string;

  reusePath: number = 3;

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

  harvest(target: Source | Mineral): number {
    if (this.creep.pos.isNearTo(target))
      this.creep.harvest(target);
    else {
      let openPositions = target.pos.getOpenPositions();
      if (openPositions.length)
        this.goTo(openPositions[0]);
    }
    return ERR_NOT_IN_RANGE;
  }

  transfer(target: Structure, resourceType: ResourceConstant, amount?: number): number {
    if (this.creep.pos.isNearTo(target))
      return this.creep.transfer(target, resourceType, amount);
    else {
      let openPositions = target.pos.getOpenPositions();
      if (openPositions.length)
        this.goTo(openPositions[0]);
    }
    return ERR_NOT_IN_RANGE;
  }

  withdraw(target: Structure, resourceType: ResourceConstant, amount?: number): number {
    if (this.creep.pos.isNearTo(target))
      return this.creep.withdraw(target, resourceType, amount);
    else {
      let openPositions = target.pos.getOpenPositions();
      if (openPositions.length)
        this.goTo(openPositions[0]);
    }
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
    else {
      let openPositions = target.pos.getOpenPositions();
      if (openPositions.length)
        this.goTo(openPositions[0]);
    }
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
    this.creep.travelTo(target, {});
  }

  /*
    getBodyparts(partType: BodyPartConstant): number {
      return _.filter(this.body, (part: BodyPartDefinition) => part.type == partType).length;
    }
  */
}
