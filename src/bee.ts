import { Master } from "beeMaster/_Master";

export class Bee {

  master: Master;

  creep: Creep;

  // for now it will be forever binded
  constructor(master: Master, creep: Creep) {
    this.master = master;
    this.creep = creep;
  }

  harvest(source: Source) {
    this.creep.harvest(source);
  }

}
