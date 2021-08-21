import { Bee } from "./bee";
import { Master } from "./beeMasters/_Master";
import { Hive } from "./Hive";
import { Order } from "./order";
import { Intel } from "./intelligence";

import { safeWrap } from "./utils";
import { profile } from "./profiler/decorator";
import { LOGGING_CYCLE } from "./settings";

@profile
export class _Apiary {
  destroyTime: number;
  intel: Intel;

  bees: { [id: string]: Bee };
  hives: { [id: string]: Hive };
  masters: { [id: string]: Master };
  orders: { [id: string]: Order };

  defenseSwarms: { [id: string]: Order } = {};

  constructor() {
    if (LOGGING_CYCLE) Memory.log.apiary = Game.time;

    this.destroyTime = Game.time + 4000;
    this.intel = new Intel();

    this.bees = {};
    this.hives = {};
    this.orders = {};
    this.masters = {};
  }

  init() {
    _.forEach(Game.rooms, (room) => {
      if (room.controller && room.controller.my)
        this.hives[room.name] = new Hive(room.name);
    });

    // get main hive
    if (_.filter(this.hives, (h) => h.stage == 2).length == 0)
      (<Hive[]>_.map(this.hives)).sort((a, b) => b.room.energyCapacityAvailable - a.room.energyCapacityAvailable)[0].stage = 2;

    // for testing 
    if (this.hives["W5N8"])
      this.hives["W5N8"].stage = 2
    if (this.hives["W7N9"])
      this.hives["W7N9"].stage = 2
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
