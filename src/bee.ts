import { Master } from "beeMaster/_Master";

export class Bee {

  master: Master;
  creep: Creep;

  // time to inherite some shit from Creep


  // for now it will be forever binded
  constructor(creep: Creep) {
    this.creep = creep;
    this.master = global.masters[this.creep.memory.refMaster];

    // not sure weather i should copy all parameters from creep like body and stuff
    global.bees[this.creep.name] = this;
  }

  harvest(source: Source) {
    if (this.creep.pos.isNearTo(source))
      this.creep.harvest(source);
    else
      this.goTo(source.pos);
  }

  transfer(target: Structure, resourceType: ResourceConstant) {
    if (this.creep.pos.isNearTo(target))
      this.creep.transfer(target, resourceType);
    else
      this.goTo(target.pos);
  }

  withdraw(target: Structure, resourceType: ResourceConstant) {
    if (this.creep.pos.isNearTo(target))
      this.creep.withdraw(target, resourceType);
    else
      this.goTo(target.pos);
  }

  build(target: ConstructionSite) {
    if (this.creep.pos.getRangeTo(target.pos) <= 3)
      this.creep.build(target);
    else
      this.goTo(target.pos);
  }

  repair(target: Structure) {
    if (this.creep.pos.getRangeTo(target.pos) <= 3)
      this.creep.repair(target);
    else
      this.goTo(target.pos);
  }

  reserveController(target: StructureController) {
    if (this.creep.pos.isNearTo(target))
      this.creep.reserveController(target);
    else
      this.goTo(target.pos);
  }

  upgradeController(target: StructureController) {
    if (this.creep.pos.getRangeTo(target.pos) <= 3)
      this.creep.upgradeController(target);
    else
      this.goTo(target.pos);
  }



  goTo(target: RoomPosition | Room) {
    if (target instanceof RoomPosition) {
      if (this.creep.pos != target)
        this.creep.moveTo(target, {
          reusePath: 3,
        });
    } else if (target instanceof Room) {
      this.creep.moveTo(new RoomPosition(25, 25, target.name), {
        reusePath: 3,
      });
    }
  }

  /*
    getBodyparts(partType: BodyPartConstant): number {
      return _.filter(this.body, (part: BodyPartDefinition) => part.type == partType).length;
    }
  */
}
