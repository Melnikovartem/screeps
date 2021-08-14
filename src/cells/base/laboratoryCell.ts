import { Cell } from "../_Cell";
import { Hive } from "../../Hive";
import { profile } from "../../profiler/decorator";

@profile
export class laboratoryCell extends Cell {
  laboratories: StructureLab[] = [];

  constructor(hive: Hive) {
    super(hive, "LaboratoryCell_" + hive.room.name);
  }

  update() {
    super.update();

    let storageCell = this.hive.cells.storage
    if (storageCell) {

    }
  };

  run() { }
}
