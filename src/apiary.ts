import { Bee } from "./bee";
import { Master } from "./beeMaster/_Master";
import { Hive } from "./Hive";
import { Order } from "./order";
import { Intel } from "./intelligence";

import { safeWrap } from "./utils";
import { profile } from "./profiler/decorator";
import { PRINT_INFO } from "./settings";

@profile
export class _Apiary {
  destroyTime: number;
  intel: Intel;

  bees: { [id: string]: Bee } = {};
  hives: { [id: string]: Hive } = {};
  masters: { [id: string]: Master } = {};
  orders: { [id: string]: Order } = {};

  constructor() {
    if (PRINT_INFO) console.log(Game.time, "creating new apiary");

    this.destroyTime = Game.time + 4000;
    this.intel = new Intel();
  }

  init() {
    _.forEach(Game.rooms, (room) => {
      if (room.controller && room.controller.my)
        this.hives[room.name] = new Hive(room.name);
    });
  }

  // update phase
  update() {
    Order.checkFlags();
    _.forEach(Apiary.orders, (order) => {
      safeWrap(() => order.update(), order.print + " update");
    });

    _.forEach(this.hives, (hive) => {
      safeWrap(() => hive.update(), hive.print + " update");
    });

    Bee.checkBees();
    _.forEach(this.bees, (bee) => {
      bee.update();
    });

    _.forEach(this.masters, (master) => {
      safeWrap(() => master.update(), master.print + " update");
    });
  }

  // run phase
  run() {
    _.forEach(this.hives, (hive) => {
      safeWrap(() => hive.run(), hive.print + " run");
    });
    _.forEach(this.masters, (master) => {
      safeWrap(() => master.run(), master.print + " run");
    });
  }
}
