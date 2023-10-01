import { STOCKPILE_CORRIDOR_COMMODITIES } from "cells/stage2/corridorMining";
import { type Hive } from "hive/hive";
import { profile } from "profiler/decorator";
import { hiveStates, prefix } from "static/enums";
import { findOptimalResource } from "static/utils";

import { HIVE_ENERGY } from "../management/storageCell";
import { CellWithTarget, PRODUCTION_COOLDOWNS } from "./cellWithTarget";

export const FACTORY_ENERGY = Math.round(FACTORY_CAPACITY * 0.16); // 8k

const COMPRESS_MAP = {
  [RESOURCE_HYDROGEN]: RESOURCE_REDUCTANT,
  [RESOURCE_OXYGEN]: RESOURCE_OXIDANT,
  [RESOURCE_UTRIUM]: RESOURCE_UTRIUM_BAR,
  [RESOURCE_LEMERGIUM]: RESOURCE_LEMERGIUM_BAR,
  [RESOURCE_KEANIUM]: RESOURCE_KEANIUM_BAR,
  [RESOURCE_ZYNTHIUM]: RESOURCE_ZYNTHIUM_BAR,
  [RESOURCE_CATALYST]: RESOURCE_PURIFIER,
  [RESOURCE_GHODIUM]: RESOURCE_GHODIUM_MELT,

  [RESOURCE_ENERGY]: RESOURCE_BATTERY,
};

type FactoryResourceConstant =
  | CommodityConstant
  | MineralConstant
  | RESOURCE_GHODIUM
  | RESOURCE_ENERGY;
export const COMMON_COMMODITIES: CommodityConstant[] = [
  RESOURCE_COMPOSITE,
  RESOURCE_CRYSTAL,
  RESOURCE_LIQUID,
];

const STOP_PRODUCTION = {
  stop: -HIVE_ENERGY * 0.25, // -50_000
  unpackEnergy: -HIVE_ENERGY * 0.4, // -80_000
};

const FACTORY_SETTINGS = {
  stockpile: {
    compressedMinerals: 5000,
    commonCommodities: 5000,
    complexCommodities: 1000,
  },
  baseProd: {
    compressedMinerals: 10,
    commonCommodities: 50,
    complexCommodities: 50,
  },
};

export const DEPOSIT_COMMODITIES: DepositConstant[] = [
  "metal",
  "biomass",
  "silicon",
  "mist",
];
// demand driven production with a little overflow prot
// so we only keep up to 1k each of pricy commodity
// no lvl (cell/alloy/etc) included for now!

export const COMPLEX_COMMODITIES: CommodityConstant[] = [
  "composite",
  "crystal",
  "liquid",
  "wire",
  "switch",
  "transistor",
  "microchip",
  "circuit",
  "device",
  "cell",
  "phlegm",
  "tissue",
  "muscle",
  "organoid",
  "organism",
  "alloy",
  "tube",
  "fixtures",
  "frame",
  "hydraulics",
  "machine",
  "condensate",
  "concentrate",
  "extract",
  "spirit",
  "emanation",
  "essence",
];

type CommodityIngredient =
  | DepositConstant
  | CommodityConstant
  | MineralConstant
  | RESOURCE_ENERGY
  | RESOURCE_GHODIUM;

@profile
export class FactoryCell extends CellWithTarget {
  // #region Properties (5)

  private level: number = 0;

  public factory: StructureFactory;
  public prod: { res: FactoryResourceConstant; plan: number } | undefined;
  public resTarget: { energy: number } & {
    [key in ResourceConstant]?: number;
  } = {
    energy: FACTORY_ENERGY,
  };
  public uncommon: boolean = false;

  // #endregion Properties (5)

  // #region Constructors (1)

  public constructor(hive: Hive, factory: StructureFactory) {
    super(hive, prefix.factoryCell);
    this.factory = factory;
    if (factory.level && factory.level > Apiary.maxFactoryLvl)
      Apiary.maxFactoryLvl = factory.level;
  }

  // #endregion Constructors (1)

  // #region Public Accessors (2)

  public get commodityTarget(): {
    res: FactoryResourceConstant;
    amount: number;
  } | null {
    return this.cache("commodityTarget");
  }

  public set commodityTarget(value) {
    this.cache("commodityTarget", value);
  }

  // #endregion Public Accessors (2)

  // #region Protected Accessors (3)

  protected get cooldownProd() {
    return PRODUCTION_COOLDOWNS.prod.factory;
  }

  protected get cooldownTarget() {
    return PRODUCTION_COOLDOWNS.target.factory;
  }

  protected get shouldProduce() {
    if (this.hive.resState.energy < STOP_PRODUCTION.unpackEnergy) return true;
    return !!this.hive.mode.depositRefining;
  }

  // #endregion Protected Accessors (3)

  // #region Public Methods (4)

  public getCreateQue(
    resToProduce: FactoryResourceConstant,
    amountToCreate: number,
    factoryLevel = this.factory.level
  ): [CommodityConstant[], { [res in CommodityIngredient]?: number }] {
    // prob should precal for each resource
    const ingredients: { [res in CommodityIngredient]?: number } = {};
    const createQue: CommodityConstant[] = [];

    // getting mineral / energy from compressed variant
    const decompressing = this.isComressableResource(resToProduce);

    const addIngredient = (
      resource: CommodityIngredient,
      amountToAdd: number
    ) => {
      if (!ingredients[resource]) ingredients[resource] = 0;
      ingredients[resource]! += amountToAdd;
    };
    // moving through the ingerdient map to get the recepie
    // maybe can bake before if becomes a problem
    // @todo
    const dfs = (
      resource: CommodityIngredient,
      depth: number,
      amountOfIngredient: number
    ) => {
      const recipe = COMMODITIES[resource as CommodityConstant];

      if (
        // raw ingredient
        !recipe ||
        // compressed mineral as an ingredient
        // (added if only needed in the final product aka depth === 0)
        (this.isComressableResource(resource) && depth > 0) ||
        // we want to decompress some res so no need for more checks
        (decompressing && depth > 0) ||
        // something that we can't produce in this hive
        (recipe.level && recipe.level !== factoryLevel) ||
        // using lvl 0 (cell/alloy/etc) or compressed minerals (oxidant/etc)
        // of the chains from the network
        (!recipe.level &&
          resource !== resToProduce &&
          (this.isComplexCommodity(resource) ||
            this.isCompressedResource(resource)) &&
          Apiary.network.getResState(resource) >= amountOfIngredient)
      ) {
        addIngredient(resource, amountOfIngredient);
        return;
      }
      // can't produce localy
      if (recipe.level && recipe.level !== this.level) return;
      const needToProduce =
        resource === resToProduce ||
        this.hive.getUsedCapacity(resource as CommodityConstant) <
          amountOfIngredient;
      if (!needToProduce) return;

      // check all ingredients down the stream
      for (const component in recipe.components)
        dfs(
          component as CommodityIngredient,
          depth + 1,
          (amountOfIngredient *
            recipe.components[component as CommodityIngredient]) /
            recipe.amount
        );

      // already producing this one
      if (createQue.indexOf(resource as CommodityConstant) !== -1) return;

      for (const [component, amount] of Object.entries(recipe.components)) {
        // not enought resources to produce
        if (
          this.hive.getUsedCapacity(component as CommodityIngredient) < amount
        )
          return;
      }

      // add to que
      createQue.push(resource as CommodityConstant);
    };

    dfs(resToProduce, 0, amountToCreate);

    return [createQue, ingredients];
  }

  public newCommodity(res: FactoryResourceConstant, num: number): number {
    const recipe = COMMODITIES[res];
    num = Math.min(
      num,
      ..._.map(recipe.components, (amount, component) =>
        Math.floor(
          this.hive.getUsedCapacity(component as CommodityIngredient) / amount
        )
      )
    );
    if (num > 0)
      this.prod = {
        res,
        plan: num * recipe.amount,
      };
    return num;
  }

  public run() {
    if (!this.prod || this.factory.cooldown) return;
    const recipe = COMMODITIES[this.prod.res];

    // all components are in
    for (const r in recipe.components) {
      const res = r as CommodityConstant;
      const balance =
        recipe.components[res] - this.factory.store.getUsedCapacity(res);
      if (balance > 0) return;
    }
    // we produce!
    const ans = this.factory.produce(this.prod.res);
    if (ans !== OK) return;

    // update future plans
    this.prod.plan -= recipe.amount;
    if (this.commodityTarget && this.prod.res === this.commodityTarget.res) {
      this.commodityTarget.amount -= recipe.amount;
    }

    // report resource usage to logger
    for (const r in recipe.components) {
      const res = r as FactoryResourceConstant;
      const amount = recipe.components[res];
      if (res in this.resTarget) this.resTarget[res]! -= amount;

      Apiary.logger.reportResourceUsage(this.hiveName, "factory", -amount, res);
    }
    Apiary.logger.reportResourceUsage(
      this.hiveName,
      "factory",
      COMMODITIES[this.prod.res].amount,
      this.prod.res
    );
  }

  public override update() {
    this.updateObjects([]);
    if (!this.factory) {
      this.delete();
      return;
    }

    this.level = 0;
    if (this.factory.effects) {
      const powerup = this.factory.effects.filter(
        (e) =>
          e.effect === PWR_OPERATE_FACTORY && e.level === this.factory.level
      ).length;
      if (powerup) this.level = this.factory.level!;
    }

    const balance =
      this.factory.store.getUsedCapacity(RESOURCE_ENERGY) -
      this.resTarget[RESOURCE_ENERGY];
    if (balance < 0)
      this.sCell.requestFromStorage(
        [this.factory],
        4,
        RESOURCE_ENERGY,
        -balance
      );

    if (this.hive.getResState(RESOURCE_ENERGY) < STOP_PRODUCTION.stop) {
      if (this.prod && this.prod.res !== RESOURCE_ENERGY)
        this.invalidateTarget();
    }

    if (!this.prod) this.stepToTarget();

    if (!this.prod) {
      for (const r in this.factory.store) {
        if (r === RESOURCE_ENERGY) continue;
        const res = r as ResourceConstant;
        this.sCell.requestToStorage([this.factory], 5, res);
      }
      return;
    }
    const recipe = COMMODITIES[this.prod.res];

    // the buff run out and new one didn't come
    if (recipe.level && this.level !== recipe.level) this.prodWaitingToStart();

    for (const r in this.factory.store) {
      const res = r as ResourceConstant;
      const amountToTransfer =
        this.factory.store.getUsedCapacity(res) - (this.resTarget[res] || 0);
      if (
        this.prod.res === res || res === RESOURCE_ENERGY
          ? amountToTransfer >= 1000
          : !(res in recipe.components)
      )
        this.sCell.requestToStorage(
          [this.factory],
          this.factory.store.getFreeCapacity() < FACTORY_CAPACITY / 5 ? 3 : 5,
          res,
          amountToTransfer
        );
    }

    let fact = this.prod.plan;
    for (const r in recipe.components) {
      const res = r as keyof typeof COMMODITIES.energy.components;
      if (res === RESOURCE_ENERGY) continue;

      const amount = recipe.components[res];
      const balanceTopUp =
        (this.prod.plan / recipe.amount) * amount -
        this.factory.store.getUsedCapacity(res);
      if (
        this.factory.store.getUsedCapacity(res) <= amount * 2 &&
        balanceTopUp > 0
      )
        this.sCell.requestFromStorage(
          [this.factory],
          4,
          res,
          Math.min(balanceTopUp, FACTORY_CAPACITY / 10) // 5k
        );
      fact = Math.min(
        fact,
        Math.floor(this.hive.getUsedCapacity(res) / amount) * amount
      );
    }

    if (this.factory.store.getFreeCapacity() < 1_000) {
      const existing = this.sCell.requests[this.factory.id];
      if (!existing || existing.to.id !== this.sCell.storage?.id)
        this.sCell.requestToStorage(
          [this.factory],
          3,
          findOptimalResource(this.factory.store),
          FACTORY_CAPACITY / 10
        );
    }
    this.CanProduceNow(fact, recipe.amount);
  }

  // #endregion Public Methods (4)

  // #region Protected Methods (1)

  public invalidateTarget() {
    this.prod = undefined;
    this.uncommon = false;
    this.commodityTarget = null;
    this.emptyResTarget();
  }

  // #endregion Protected Methods (1)

  // #region Private Methods (8)

  private emptyResTarget() {
    this.resTarget = { [RESOURCE_ENERGY]: FACTORY_ENERGY };
  }

  private isCommonComodity(res: string) {
    return (COMMON_COMMODITIES as string[]).includes(res);
  }

  /** any commodity that needs production */
  private isComplexCommodity(res: string) {
    return (COMPLEX_COMMODITIES as string[]).includes(res);
  }

  private isCompressedResource(res: string) {
    return (Object.values(COMPRESS_MAP) as string[]).includes(res);
  }

  private isComressableResource(res: string) {
    return Object.keys(COMPRESS_MAP).includes(res);
  }

  private isDepositCommodity(res: string) {
    return (DEPOSIT_COMMODITIES as string[]).includes(res);
  }

  private newTarget() {
    // prev target is fine
    if (
      this.commodityTarget &&
      this.commodityTarget.amount > COMMODITIES[this.commodityTarget.res].amount
    )
      return OK;
    // cooldown for finding target
    if (!this.shouldFindTarget) return ERR_BUSY;
    this.invalidateTarget();

    let targets: { res: FactoryResourceConstant; amount: number }[] = [];
    let toCheck = Object.keys(COMMODITIES);
    if (this.hive.getResState(RESOURCE_ENERGY) < STOP_PRODUCTION.stop)
      toCheck = [RESOURCE_ENERGY];

    for (const resToCheck of toCheck) {
      const res = resToCheck as FactoryResourceConstant; // actually ResourceConstant
      const recipe = COMMODITIES[res];

      if (recipe.level && recipe.level !== this.factory.level) continue;
      let num = 0;

      if (res === RESOURCE_ENERGY) {
        // energy below 100000
        const toProduce =
          -this.hive.getResState(res) + STOP_PRODUCTION.unpackEnergy;
        num = Math.max(0, Math.ceil(toProduce / recipe.amount));
        const batteryInNetwork = Apiary.network.getResState(RESOURCE_BATTERY);
        const batteryInHive = this.sCell.storageUsedCapacity(RESOURCE_BATTERY);
        if (num > 0 && Math.max(batteryInNetwork, batteryInHive) <= 0) num = 0;
      } else if (res === RESOURCE_BATTERY) {
        // can compress some energy
        if (
          this.hive.resState.energy < 10000 ||
          this.hive.state !== hiveStates.economy ||
          !(res in this.hive.resState)
        )
          continue;
        const toProduce = 500 - this.hive.getResState(res);
        num = Math.max(0, Math.ceil(toProduce / recipe.amount));
      } else {
        let amountInNetwork = Apiary.network.getResState(res);
        let mode: keyof (typeof FACTORY_SETTINGS)["stockpile"] | undefined;

        // no need to overproduce the amount of stuff (demand driven production)
        if (this.isCompressedResource(res)) {
          mode = "compressedMinerals";
        } else if (this.isCommonComodity(res)) {
          mode = "commonCommodities";
        } else if (this.isComplexCommodity(res)) {
          mode = "complexCommodities";
          // always produce max of the latest lvl
          if (recipe.level === Apiary.maxFactoryLvl) amountInNetwork = 0;
        } // else if (this.isComressableResource) // minerals

        if (!mode) continue;
        if (amountInNetwork >= FACTORY_SETTINGS.stockpile[mode]) continue;

        num = FACTORY_SETTINGS.baseProd[mode];

        const componentAmount: number[] = [];

        // check if we have enough complex commodities
        _.forEach(recipe.components, (amountNeeded, comp) => {
          const component = comp as FactoryResourceConstant | DepositConstant;

          if (
            !this.isComplexCommodity(component) &&
            !this.isDepositCommodity(component)
          )
            return;

          let toUse = this.hive.getUsedCapacity(component);
          const networkAmount = Apiary.network.getResState(component);
          // use recources from network if a lot unused in network or can't produce localy
          if (
            recipe.level ||
            networkAmount >= STOCKPILE_CORRIDOR_COMMODITIES.compress.global
          )
            toUse = Math.max(toUse, networkAmount);
          componentAmount.push(toUse / amountNeeded);
        });
        num = Math.min(num, ...componentAmount);
      }

      if (recipe.level && recipe.level !== this.level) {
        num = 0;
        // ask for boost if not yet boosted
        this.uncommon = true;
      }
      if (num > 1)
        targets.push({ res, amount: Math.floor(num) * recipe.amount });
    }
    if (!targets.length) {
      /** recheck after cooldown time if we got boosts or anything changed */
      this.notFoundTarget();
      return ERR_NOT_FOUND;
    }

    const nonCommon = targets.filter((t) => !this.isCommonComodity(t.res));
    if (nonCommon.length) targets = nonCommon;

    // higher is more urgent
    const getlvlPriority = (cc: { res: FactoryResourceConstant }) => {
      // uncompress any energy / mineral
      if (this.isComressableResource(cc.res)) return 3;
      if (COMMODITIES[cc.res].level) return 2;
      if (this.isCommonComodity(cc.res)) return -1;
      if (this.isCompressedResource(cc.res)) return -2;
      return 0;
    };

    this.commodityTarget = targets.reduce((prev, curr) => {
      let ans = getlvlPriority(prev) - getlvlPriority(curr);
      if (ans === 0) ans = curr.amount - prev.amount;
      if (ans === 0)
        ans =
          this.hive.getUsedCapacity(curr.res) -
          this.hive.getUsedCapacity(prev.res);
      return ans < 0 ? curr : prev;
    });
    this.foundTarget();
    return OK;
  }

  private stepToTarget() {
    this.emptyResTarget();
    if (this.newTarget() !== OK || !this.commodityTarget) return;

    const [createQue, ingredients] = this.getCreateQue(
      this.commodityTarget.res,
      this.commodityTarget.amount
    );

    for (const [component, amount] of Object.entries(ingredients)) {
      const commodity = this.isComplexCommodity(component);
      // ask for 2x more of non commodity resources
      let amountNeeded = Math.min(amount * (commodity ? 1 : 2), 10_000);
      if (component === RESOURCE_ENERGY) amountNeeded += FACTORY_ENERGY;
      this.resTarget[component as CommodityIngredient] = amountNeeded;
    }

    const recipeTarget = COMMODITIES[this.commodityTarget.res];
    this.uncommon = this.uncommon || !!recipeTarget.level;
    const amountInProduction =
      createQue.length &&
      this.newCommodity(
        createQue.reduce((prev, curr) =>
          this.hive.getUsedCapacity(curr) < this.hive.getUsedCapacity(prev)
            ? curr
            : prev
        ),
        this.commodityTarget.amount / recipeTarget.amount
      );

    this.prodPatienceCheck(amountInProduction);
  }

  // #endregion Private Methods (8)
}
