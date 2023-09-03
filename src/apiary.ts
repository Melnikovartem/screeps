import { WarcrimesModule } from "abstract/warModule";
import type { Master, MasterParent } from "beeMasters/_Master";
import type { HordeMaster } from "beeMasters/war/horde";
import { Bee } from "bees/bee";
import { PowerBee } from "bees/powerBee";
import type { ProtoBee } from "bees/protoBee";
import { Broker } from "bugSmuggling/broker";
import { Network } from "bugSmuggling/terminalNetwork";
import { Logger } from "convenience/logger";
import { EmptyLogger } from "convenience/logger-empty";
import { Visuals } from "convenience/visuals/visuals";
import { Engine } from "engine";
import { Hive } from "hive/hive";
import { SwarmOrder } from "orders/swarmOrder";
import { profile } from "profiler/decorator";
import { APIARY_LIFETIME, LOGGING_CYCLE } from "settings";
import { Intel } from "spiderSense/intelligence";
import { safeWrap } from "static/utils";

const STARVE_HIM_OUT_CLAIMS = [""];

@profile
export class _Apiary {
  // #region Properties (19)

  public bees: { [id: string]: ProtoBee<Creep | PowerCreep> } = {};
  public broker: Broker;
  public createTime: number;
  public defenseSwarms: { [id: string]: HordeMaster } = {};
  public destroyTime: number;
  public engine: Engine = new Engine();
  public hives: { [id: string]: Hive } = {};
  public intel: Intel = new Intel();
  public logger: EmptyLogger;
  public masters: { [id: string]: Master<MasterParent> } = {};
  public maxFactoryLvl = 0;
  public network: Network;
  public orders: { [ref: string]: SwarmOrder<any> } = {};
  public requestRoomSight: string[] = [];
  public requestRoomSightNextTick: string[] = [];
  public useBucket: boolean = false;
  public username: string = "";
  public visuals: Visuals = new Visuals();
  public warcrimes: WarcrimesModule;

  // #endregion Properties (19)

  // #region Constructors (1)

  public constructor() {
    this.createTime = Game.time;
    this.destroyTime = this.createTime + APIARY_LIFETIME;
    this.intel = new Intel();
    this.broker = new Broker();
    this.network = new Network();
    this.warcrimes = new WarcrimesModule();
    if (LOGGING_CYCLE) this.logger = new Logger();
    else this.logger = new EmptyLogger();
  }

  // #endregion Constructors (1)

  // #region Public Accessors (1)

  /** internal clock time */
  public get intTime() {
    return Game.time - this.createTime;
  }

  // #endregion Public Accessors (1)

  // #region Public Methods (5)

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
      this.logger = new EmptyLogger(); // failsafe
    }
    this.network.init();
    this.warcrimes.init();
    SwarmOrder.init();
  }

  public requestSight(roomName: string) {
    if (!this.requestRoomSightNextTick.includes(roomName))
      this.requestRoomSightNextTick.push(roomName);
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

    this.engine.run();

    this.wrap(
      () => this.visuals.run(),
      "visuals",
      "run",
      Object.keys(this.hives).length
    );
    if (this.logger) this.logger.run();
  }

  // update phase
  public update() {
    this.useBucket = Game.cpu.bucket > 500;
    this.wrap(() => this.intel.update(), "intel", "update");

    this.wrap(() => this.broker.update(), "broker", "update");

    // this.wrap(() => FlagOrder.checkFlags(), "checkFlags", "update");

    this.wrap(() => this.network.update(), "network", "update", 0);

    this.wrap(() => this.warcrimes.update(), "warcrimes", "update");

    // loses about 0.05 per hive of cpu log, but more detailed
    _.forEach(this.hives, (hive) => {
      this.wrap(() => hive.update(), hive.roomName, "update", 0);
    });

    this.wrap(() => Bee.checkAliveBees(), "checkBees", "update");
    this.wrap(() => PowerBee.checkAliveBees(), "checkPowerBees", "update");
    _.forEach(this.bees, (bee) => {
      bee.update();
    });

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

  public wrap(
    func: () => void,
    ref: string,
    mode: "update" | "run",
    amount = 1
  ) {
    const cpu = Game.cpu.getUsed();
    if (Memory.settings.safeWrap) safeWrap(func, ref + " " + mode);
    else func();
    // if amount zero we skip the wrap (avoid double counting)
    if (amount)
      this.logger.reportCPU(ref, mode, Game.cpu.getUsed() - cpu, amount);
  }

  // #endregion Public Methods (5)
}
