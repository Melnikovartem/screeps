import { Cell } from "../_Cell";
import { Hive } from "../../Hive";
import { profile } from "../../profiler/decorator";

@profile
export class observeCell extends Cell {
  obeserver: StructureObserver;
  roomsToCheck: string[] = [];

  constructor(hive: Hive, obeserver: StructureObserver) {
    super(hive, "ObserveCell_" + hive.room.name);
    this.obeserver = obeserver;
  }

  update() {
    super.update();
    this.roomsToCheck = this.hive.annexNames;
  }

  run() {
    this.obeserver.observeRoom(this.roomsToCheck[Math.floor(Math.random() * this.roomsToCheck.length)]);
  }
}
