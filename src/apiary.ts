import { Bee } from "./bees/bee";
import { Master } from "./beeMasters/_Master";
import { Hive } from "./Hive";
import { Order } from "./order";
import { Intel } from "./abstract/intelligence";
import { Logger } from "./convenience/logger";
import { RoomPlanner } from "./abstract/RoomPlanner";
import { Visuals } from "./convenience/visuals";

import { safeWrap } from "./abstract/utils";
import { profile } from "./profiler/decorator";
import { LOGGING_CYCLE } from "./settings";


@profile
export class _Apiary {
  destroyTime: number;
  useBucket: boolean = false;
  username: string = "";
  intel: Intel;
  planner: RoomPlanner;
  logger: Logger | undefined;
  visuals: Visuals | undefined;

  bees: { [id: string]: Bee };
  hives: { [id: string]: Hive };
  masters: { [id: string]: Master };
  orders: { [id: string]: Order };

  defenseSwarms: { [id: string]: Order } = {};

  constructor() {
    this.destroyTime = Game.time + 6000;
    this.intel = new Intel();
    this.planner = new RoomPlanner();
    if (LOGGING_CYCLE)
      this.logger = new Logger();

    this.bees = {};
    this.hives = {};
    this.orders = {};
    this.masters = {};
  }

  init() {
    _.forEach(Game.rooms, (room) => {
      if (room.controller && room.controller.my) {
        this.username = room.controller.owner!.username;
        this.hives[room.name] = new Hive(room.name);
      }
    });
  }

  // update phase
  update() {
    this.useBucket = Game.cpu.bucket > 500;
    Order.checkFlags();
    _.forEach(Apiary.orders, (order) => {
      if (order)
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

    if (Game.time % 50 === 0)
      this.intel.toCache();

    if (this.visuals && !Memory.settings.framerate)
      this.visuals = undefined;
    else if (!this.visuals && Memory.settings.framerate)
      this.visuals = new Visuals();
  }

  // run phase
  run() {
    _.forEach(this.hives, (hive) => {
      safeWrap(() => hive.run(), hive.print + " run");
    });
    _.forEach(this.masters, (master) => {
      safeWrap(() => master.run(), master.print + " run");
    });

    if (this.useBucket) {
      Apiary.planner.run();
      if (this.visuals)
        this.visuals.create();
    } else if (this.visuals)
      this.visuals.createLight();
  }
}
