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

  // for future: could path to open position near object for targets that require isNearTo
  // but is it worh in terms of CPU?

  print(info: any) {
    console.log(Game.time, "!", this.creep.name, "?", info);
  }

  attack(target: Creep | Structure | PowerCreep): number {
    if (this.creep.pos.isNearTo(target))
      return this.creep.attack(target);
    else
      return this.goTo(target);
  }

  harvest(target: Source | Mineral): number {
    if (this.creep.pos.isNearTo(target))
      return this.creep.harvest(target);
    else
      return this.goTo(target);
  }

  transfer(target: Structure, resourceType: ResourceConstant, amount?: number): number {
    if (this.creep.pos.isNearTo(target))
      return this.creep.transfer(target, resourceType, amount);
    else
      return this.goTo(target);
  }

  withdraw(target: Structure, resourceType: ResourceConstant, amount?: number): number {
    if (this.creep.pos.isNearTo(target))
      return this.creep.withdraw(target, resourceType, amount);
    else
      return this.goTo(target);
  }

  build(target: ConstructionSite): number {
    if (this.creep.pos.getRangeTo(target.pos) <= 3)
      return this.creep.build(target);
    else
      return this.goTo(target);
  }

  repair(target: Structure): number {
    if (this.creep.pos.getRangeTo(target.pos) <= 3)
      return this.creep.repair(target);
    else
      return this.goTo(target);
  }

  upgradeController(target: StructureController): number {
    if (this.creep.pos.getRangeTo(target.pos) <= 3)
      return this.creep.upgradeController(target);
    else
      return this.goTo(target);
  }

  reserveController(target: StructureController): number {
    if (this.creep.pos.isNearTo(target))
      return this.creep.reserveController(target);
    else
      return this.goTo(target);
  }

  attackController(target: StructureController): number {
    if (this.creep.pos.isNearTo(target))
      return this.creep.attackController(target);
    else
      return this.goTo(target);
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
