import { ColonyBrianModule } from "antBrain/colonyModule";
import { WarcrimesModule } from "antBrain/warModule";
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
import { FlagCommand } from "orders/flagCommands";
import { SwarmOrder } from "orders/swarmOrder";
import { profile } from "profiler/decorator";
import { APIARY_LIFETIME, LOGGING_CYCLE } from "settings";
import { Intel } from "spiderSense/intel";
import { Oracle } from "spiderSense/oracle";
import { safeWrap } from "static/utils";

const STARVE_HIM_OUT_CLAIMS = [""];

@profile
export class _Apiary {
  // #region Properties (11)

  // careful ordered list!
  private modules = {
    intel: new Intel(),
    broker: new Broker(),
    network: new Network(),
    war: new WarcrimesModule(),
    colony: new ColonyBrianModule(),
    engine: new Engine(),
    oracle: new Oracle(),
    visuals: new Visuals(),
    logger: new EmptyLogger(),
  };

  public bees: { [creepName: string]: ProtoBee<Creep | PowerCreep> } = {};
  public createTime: number;
  public flags: { [flagName: string]: FlagCommand } = {};
  public defenseSwarms: { [id: string]: HordeMaster } = {};
  public destroyTime: number;
  public hives: { [roomName: string]: Hive } = {};
  public masters: { [mParentRef: string]: Master<MasterParent> } = {};
  public maxFactoryLvl = 0;
  public orders: { [ref: string]: SwarmOrder<any> } = {};
  public useBucket: boolean = false;
  public username: string = "";
  public spareCpu: number[] = [];

  // #endregion Properties (11)

  // #region Constructors (1)

  public constructor() {
    this.createTime = Game.time;
    this.destroyTime = this.createTime + APIARY_LIFETIME;
    if (LOGGING_CYCLE) this.modules.logger = new Logger();
  }

  // #endregion Constructors (1)

  // #region Public Accessors (10)

  public get broker() {
    return this.modules.broker;
  }

  public get colony() {
    return this.modules.colony;
  }

  public get engine() {
    return this.modules.engine;
  }

  /** internal clock time */
  public get intTime() {
    return Game.time - this.createTime;
  }

  public get intel() {
    return this.modules.intel;
  }

  public get logger() {
    return this.modules.logger;
  }

  public get network() {
    return this.modules.network;
  }

  public get oracle() {
    return this.modules.oracle;
  }

  public get visuals() {
    return this.modules.visuals;
  }

  public get war() {
    return this.modules.war;
  }

  // #endregion Public Accessors (10)

  // #region Public Methods (4)

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
      this.modules.logger = new EmptyLogger(); // failsafe
    }
    _.forEach(this.modules, (module) => {
      if ("init" in module) module.init();
    });
    SwarmOrder.init();
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

    // run modules
    _.forEach(this.modules, (module, ref) => {
      let amount = 1;
      switch (ref) {
        case "network":
          amount = this.network.nodes.length;
          break;
        case "engine":
          (module as Engine).run();
          return;
      }
      if ("run" in module)
        this.wrap(() => module.run(), ref || "", "run", amount);
    });
  }

  // update phase
  public update() {
    this.useBucket = Game.cpu.bucket > 500;

    // update modules
    _.forEach(this.modules, (module, ref) => {
      let amount = 1;
      switch (ref) {
        case "network":
          amount = 0;
          break;
      }
      if ("update" in module)
        this.wrap(() => module.update(), ref || "", "update", amount);
    });

    // loses about 0.05 per hive of cpu log, but more detailed
    _.forEach(this.hives, (hive) => {
      this.wrap(() => hive.update(), hive.roomName, "update", 0);
    });

    this.wrap(() => FlagCommand.checkFlags(), "checkFlags", "update");
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

    this.wrap(
      () => {
        _.forEach(this.flags, (f) => f.update());
      },
      "actFlags",
      "update",
      Object.keys(this.flags).length
    );

    this.spareCpu.push(Game.cpu.limit - Game.cpu.getUsed());
    if (this.spareCpu.length > 100) this.spareCpu.shift();
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

  // #endregion Public Methods (4)
}
