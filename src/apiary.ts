import { Bee } from "./bees/bee";
import { Master } from "./beeMasters/_Master";
import { Hive } from "./Hive";
import { FlagOrder } from "./order";
import { Intel } from "./abstract/intelligence";
import { Broker } from "./abstract/broker";
import { Logger } from "./convenience/logger";
import { RoomPlanner } from "./abstract/RoomPlanner";
import { Network } from "./abstract/terminalNetwork";
import { Visuals } from "./convenience/visuals";

import { safeWrap } from "./abstract/utils";
import { profile } from "./profiler/decorator";
import { LOGGING_CYCLE } from "./settings";

const STARVE_HIM_OUT_CLAIMS = [""];

@profile
export class _Apiary {
  createTime: number;
  destroyTime: number;
  useBucket: boolean = false;
  username: string = "";
  intel: Intel;
  broker: Broker;
  planner: RoomPlanner;
  network: Network;
  logger: Logger | undefined;
  visuals: Visuals = new Visuals;

  bees: { [id: string]: Bee };
  hives: { [id: string]: Hive };
  masters: { [id: string]: Master };
  orders: { [id: string]: FlagOrder };

  defenseSwarms: { [id: string]: FlagOrder } = {};
  requestRoomSight: string[] = [];

  constructor() {
    this.createTime = Game.time;
    this.destroyTime = this.createTime + 9000;
    this.intel = new Intel();
    this.broker = new Broker();
    this.planner = new RoomPlanner();
    this.network = new Network({});
    if (LOGGING_CYCLE)
      this.logger = new Logger();

    this.bees = {};
    this.hives = {};
    this.orders = {};
    this.masters = {};
  }

  init() {
    _.forEach(Game.rooms, room => {
      if (STARVE_HIM_OUT_CLAIMS.includes(room.name))
        return;
      if (room.controller && room.controller.my) {
        this.username = room.controller.owner!.username;
        this.hives[room.name] = new Hive(room.name);
      }
    });
    if (!Object.keys(this.hives).length) {
      // case inter-shard migration
      let roomName = Object.keys(Game.rooms)[0];
      let protoHive = new Hive(roomName);
      protoHive.update = () => { };
      protoHive.run = () => { };
      this.hives[roomName] = protoHive;
      this.logger = undefined;
      Memory.settings.framerate = -1;
    }
    this.network = new Network(this.hives);
  }

  requestSight(roomName: string) {
    if (!this.requestRoomSight.includes(roomName))
      this.requestRoomSight.push(roomName);
  }

  wrap(func: () => void, ref: string, mode: "update" | "run", amount = 1, safe = true) {
    let cpu = 0;
    if (Apiary.logger)
      cpu = Game.cpu.getUsed()
    if (safe)
      safeWrap(func, ref + " " + mode);
    else
      func();
    if (Apiary.logger && amount > 0)
      Apiary.logger.reportCPU(ref, mode, Game.cpu.getUsed() - cpu, amount);
  }

  // update phase
  update() {
    if (this.logger)
      this.logger.update();

    this.useBucket = Game.cpu.bucket > 500 || Memory.settings.forceBucket > 0;
    this.intel.update();

    FlagOrder.checkFlags();
    _.forEach(Apiary.orders, order => {
      if (order)
        this.wrap(() => order.update(), order.ref, "update");
    });

    this.wrap(() => this.network.update(), "network", "update", this.network.nodes.length);

    _.forEach(this.hives, hive => {
      this.wrap(() => hive.update(), hive.roomName, "update", 0);
    });

    Bee.checkBees();
    _.forEach(this.bees, bee => {
      bee.update();
    });

    _.forEach(this.masters, master => {
      this.wrap(() => master.update(), master.ref, "update", master.beesAmount);
    });
  }

  // run phase
  run() {
    _.forEach(this.hives, hive => {
      this.wrap(() => hive.run(), hive.roomName, "run", 0);
    });

    _.forEach(this.masters, master => {
      this.wrap(() => master.run(), master.ref, "run", master.beesAmount);
    });

    Bee.beesMove();
    this.wrap(() => this.network.run(), "network", "run", this.network.nodes.length);

    this.requestRoomSight = [];

    if (this.useBucket)
      this.wrap(() => Apiary.planner.run(), "planner", "run", 1, false);

    this.wrap(() => this.visuals.run(), "visuals", "run", Object.keys(this.hives).length, false);
    if (this.logger)
      this.logger.run();
  }
}
