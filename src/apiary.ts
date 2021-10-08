import { Bee } from "./bees/bee";
import { Master } from "./beeMasters/_Master";
import { Hive } from "./Hive";
import { Order } from "./order";
import { Intel } from "./abstract/intelligence";
import { Broker } from "./abstract/broker";
import { Logger } from "./convenience/logger";
import { RoomPlanner } from "./abstract/RoomPlanner";
import { Visuals } from "./convenience/visuals";

import { safeWrap } from "./abstract/utils";
import { profile } from "./profiler/decorator";
import { LOGGING_CYCLE } from "./settings";


@profile
export class _Apiary {
  createTime: number;
  destroyTime: number;
  useBucket: boolean = false;
  username: string = "";
  intel: Intel;
  broker: Broker;
  planner: RoomPlanner;
  logger: Logger | undefined;
  visuals: Visuals = new Visuals;

  bees: { [id: string]: Bee };
  hives: { [id: string]: Hive };
  masters: { [id: string]: Master };
  orders: { [id: string]: Order };

  defenseSwarms: { [id: string]: Order } = {};
  requestRoomSight: string[] = [];

  constructor() {
    this.createTime = Game.time;
    this.destroyTime = this.createTime + 9000;
    this.intel = new Intel();
    this.broker = new Broker();
    this.planner = new RoomPlanner();
    if (LOGGING_CYCLE)
      this.logger = new Logger();

    this.bees = {};
    this.hives = {};
    this.orders = {};
    this.masters = {};
  }

  init() {
    _.forEach(Game.rooms, room => {
      if (room.controller && room.controller.my) {
        this.username = room.controller.owner!.username;
        this.hives[room.name] = new Hive(room.name);
      }
    });
    if (!Object.keys(this.hives).length) {
      // case inter-shard migration
      let roomName = Object.keys(Game.rooms)[0];
      this.hives[roomName] = new Hive(roomName);
    }
  }

  requestSight(roomName: string) {
    if (!this.requestRoomSight.includes(roomName))
      this.requestRoomSight.push(roomName);
  }

  // update phase
  update() {
    this.useBucket = Game.cpu.bucket > 500 || Memory.settings.forceBucket > 0;

    if (Game.time % 25 === 0 || this.broker.lastUpdated < 0)
      this.broker.update();

    Order.checkFlags();
    _.forEach(Apiary.orders, order => {
      if (order)
        safeWrap(() => order.update(), order.print + " update");
    });

    _.forEach(this.hives, hive => {
      safeWrap(() => hive.update(), hive.print + " update");
    });

    Bee.checkBees();
    _.forEach(this.bees, bee => {
      bee.update();
    });

    _.forEach(this.masters, master => {
      safeWrap(() => master.update(), master.print + " update");
    });

    if (Game.time % 50 === 0)
      this.intel.toCache();
  }

  // run phase
  run() {
    _.forEach(this.hives, hive => {
      safeWrap(() => hive.run(), hive.print + " run");
    });

    _.forEach(this.masters, master => {
      safeWrap(() => master.run(), master.print + " run");
    });
    Bee.beesMove();
    this.requestRoomSight = [];

    if (this.useBucket)
      Apiary.planner.run();

    this.visuals.create();
  }
}
