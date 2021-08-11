import { Setups } from "../../creepSetups"
import type { SpawnOrder, Hive } from "../../Hive";
import { Master } from "../_Master";

export class puppetMaster extends Master {
  target: RoomPosition; //controllers rly don't age...

  constructor(hive: Hive, annexName: string) {
    super(hive, "master_" + "puppetFor_" + annexName);

    this.target = new RoomPosition(25, 25, annexName);
  }

  update() {
    super.update();

    // 5 for random shit
    if (this.checkBees() && !(this.target.roomName in Game.rooms)) {
      this.print([this.checkBees(), this.beesAmount, this.target.roomName in Game.rooms])
      let order: SpawnOrder = {
        master: this.ref,
        setup: Setups.puppet,
        amount: 1,
        priority: 1, // well it is cheap -_-
      };

      this.wish(order);
    }
  }

  run() {
    if (Game.rooms[this.target.roomName]) {
      // for now will recreate everything
      global.Apiary.destroyTime = Game.time + 10;
    }
    _.forEach(this.bees, (bee) => {
      if (bee.pos.getRangeTo(this.target) > 10)
        bee.goTo(this.target);
    });
  }
}
