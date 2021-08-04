import { Cell } from "./_Cell";
import { Hive } from "../Hive";

export class upgradeCell extends Cell {

  controller: StructureController;


  constructor(hive: Hive, controller: StructureController) {
    super(hive, "controllerCell");

    this.controller = controller;
  }

  update() { }

  run() { }
}
