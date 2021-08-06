import { Master } from "beeMaster/_Master";

export class Bee {

  master: Master;

  creep: Creep;
  // time to inherite some shit from Creep


  // for now it will be forever binded
  constructor(master: Master, creep: Creep) {
    this.master = master;
    this.creep = creep;

    // not sure weather i should copy all parameters from creep like body and stuff
  }

  harvest(source: Source) {
    this.creep.harvest(source);
  }

  transfer(target: Structure, resourceType: ResourceConstant) {
    this.creep.transfer(target, resourceType);
  }

  reserveController(target: StructureController) {
    this.creep.reserveController(target);
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
