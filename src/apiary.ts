import { Broker } from "abstract/broker";
import { Intel } from "abstract/intelligence";
import { RoomPlanner } from "abstract/roomPlanner";
import { WarcrimesModule } from "abstract/warModule";
import { Master } from "beeMasters/_Master";
import type { HordeMaster } from "beeMasters/war/horde";
import { Bee } from "bees/bee";
import { PowerBee } from "bees/powerBee";
import { ProtoBee } from "bees/protoBee";
import { Network } from "bugSmuggling/terminalNetwork";
import { Logger } from "convenience/logger";
import { Visuals } from "convenience/visuals";
import { Hive } from "Hive";
import { FlagOrder } from "orders/order";
import { profile } from "profiler/decorator";
import { APIARY_LIFETIME, LOGGING_CYCLE } from "settings";
import { safeWrap } from "static/utils";

const STARVE_HIM_OUT_CLAIMS = [""];

@profile
export class _Apiary {
  public createTime: number;
  public destroyTime: number;
  public useBucket: boolean = false;
  public username: string = "";
  public intel: Intel;
  public broker: Broker;
  public planner: RoomPlanner;
  public network: Network;
  public warcrimes: WarcrimesModule;
  public logger: Logger | undefined;
  public visuals: Visuals = new Visuals();

  public bees: { [id: string]: ProtoBee<Creep | PowerCreep> };
  public hives: { [id: string]: Hive };
  public masters: { [id: string]: Master };
  public orders: { [fid: string]: FlagOrder };

  public defenseSwarms: { [id: string]: HordeMaster } = {};
  public requestRoomSight: string[] = [];
  public requestRoomSightNextTick: string[] = [];

  public constructor() {
    this.createTime = Game.time;
    this.destroyTime = this.createTime + APIARY_LIFETIME;
    this.intel = new Intel();
    this.broker = new Broker();
    this.planner = new RoomPlanner();
    this.network = new Network();
    this.warcrimes = new WarcrimesModule();
    if (LOGGING_CYCLE) this.logger = new Logger();

    this.bees = {};
    this.hives = {};
    this.orders = {};
    this.masters = {};
  }

  public init() {
    _.forEach(Game.rooms, (room) => {
      if (STARVE_HIM_OUT_CLAIMS.includes(room.name)) return;
      if (room.controller && room.controller.my) {
        this.username = room.controller.owner!.username;
        this.hives[room.name] = new Hive(room.name);
      }
    });
    if (!Object.keys(this.hives).length) {
      // case inter-shard migration
      const roomName = Object.keys(Game.rooms)[0];
      const protoHive = new Hive(roomName);
      protoHive.update = () => {};
      protoHive.run = () => {};
      this.hives[roomName] = protoHive;
      this.logger = undefined;
    }
    this.network.init();
    this.warcrimes.init();
  }

  public requestSight(roomName: string) {
    if (!this.requestRoomSightNextTick.includes(roomName))
      this.requestRoomSightNextTick.push(roomName);
  }

  public unsignedRoom(roomName: string) {
    if (Memory.cache.roomsToSign.includes(roomName)) return;
    if (
      _.filter(this.hives, (h) => h.pos.getRoomRangeTo(roomName) <= 10).length
    )
      Memory.cache.roomsToSign.push(roomName);
  }

  public wrap(
    func: () => void,
    ref: string,
    mode: "update" | "run",
    amount = 1,
    safe = true
  ) {
    const cpu = Game.cpu.getUsed();
    if (safe) safeWrap(func, ref + " " + mode);
    else func();
    // if amount zero we skip the wrap (avoid double counting)
    if (Memory.settings.reportCPU && this.logger && amount)
      this.logger.reportCPU(ref, mode, Game.cpu.getUsed() - cpu, amount);
  }

  // update phase
  public update() {
    this.useBucket = Game.cpu.bucket > 500;
    this.wrap(() => this.intel.update(), "intel", "update");

    this.wrap(() => this.broker.update(), "broker", "update");

    this.wrap(() => FlagOrder.checkFlags(), "checkFlags", "update");
    _.forEach(Apiary.orders, (order) => {
      if (order) this.wrap(() => order.update(), order.ref, "update");
    });

    this.wrap(() => this.network.update(), "network", "update", 0);

    this.wrap(() => this.warcrimes.update(), "warcrimes", "update");

    // loses about 0.05 per hive of cpu log, but more detailed
    _.forEach(this.hives, (hive) => {
      this.wrap(() => hive.update(), hive.roomName, "update", 0);
    });

    this.wrap(() => Bee.checkBees(), "checkBees", "update");
    this.wrap(() => PowerBee.checkBees(), "checkPowerBees", "update");
    _.forEach(this.bees, (bee) => {
      bee.update();
    });

    const cpu = Game.cpu.getUsed();
    _.forEach(this.masters, (master) => {
      if (master)
        this.wrap(
          () => master.update(),
          master.ref,
          "update",
          master.beesAmount
        );
    });
  }

  // run phase
  public run() {
    _.forEach(this.hives, (hive) => {
      this.wrap(() => hive.run(), hive.roomName, "run", 0);
    });

    _.forEach(this.masters, (master) => {
      if (master)
        this.wrap(() => master.run(), master.ref, "run", master.beesAmount);
    });

    Bee.beesMove();
    this.wrap(
      () => this.network.run(),
      "network",
      "run",
      this.network.nodes.length
    );
    this.wrap(() => this.warcrimes.run(), "warcrimes", "run", 1);

    this.requestRoomSight = this.requestRoomSightNextTick;
    this.requestRoomSightNextTick = [];

    if (this.useBucket)
      this.wrap(() => Apiary.planner.run(), "planner", "run", 1, false);

    this.wrap(
      () => this.visuals.run(),
      "visuals",
      "run",
      Object.keys(this.hives).length,
      false
    );
    if (this.logger) this.logger.run();
  }
}
