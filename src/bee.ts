import { BeeMaster } from "beeMaster/beeMaster";

export class Bee {

  master: BeeMaster;

  creep: Creep;

  // for now it will be forever binded
  constructor(master: BeeMaster, creep: Creep) {
    this.master = master;
    this.creep = creep;
  }

  harvest(source: Source) {
    this.creep.harvest(source);
  }

}
