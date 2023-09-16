import { type Hive } from "hive/hive";
import { profile } from "profiler/decorator";
import { hiveStates, prefix } from "static/enums";
import { findOptimalResource } from "static/utils";

import { Cell } from "../_Cell";
import { HIVE_ENERGY } from "../management/storageCell";

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

const STOP_PRODUCTION = -HIVE_ENERGY * 0.25; // 50000
const COMMON_COMMODITIES_STOCKPILE = 5000;

export const DEPOSIT_COMMODITIES: DepositConstant[] = [
  "metal",
  "biomass",
  "silicon",
  "mist",
];
// demand driven production with a little overflow prot
// so we only keep up to 1k each of pricy commodity
// no lvl (cell/alloy/etc) included for now!
const STOCKPILE_HIGH_COMMODITIES = 1000;
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

const COOLDOWN_TARGET_FACTORY = 50;

export const STOCKPILE_BASE_COMMODITIES = {
  /** start compressing not locally but over the apiary */
  alot: 16_000,
  /** stop mining but this time only in the hive with big stockpile  */
  toomuch: 32_000,
};

@profile
export class FactoryCell extends Cell {
  // #region Properties (9)

  public _commodityTarget: {
    res: FactoryResourceConstant;
    amount: number;
  } | null = this.cache("_commodityTarget");
  public commodityRes?: FactoryResourceConstant;
  public factory: StructureFactory;
  public level: number = 0;
  public patience: number = 0;
  public patienceProd: number = 0;
  public prod?: { res: FactoryResourceConstant; plan: number };
  public resTarget: { energy: number } & {
    [key in ResourceConstant]?: number;
  } = {
    energy: FACTORY_ENERGY,
  };
  public uncommon: boolean = false;

  // #endregion Properties (9)

  // #region Constructors (1)

  public constructor(hive: Hive, factory: StructureFactory) {
    super(hive, prefix.factoryCell);
    this.factory = factory;
    if (factory.level && factory.level > Apiary.maxFactoryLvl)
      Apiary.maxFactoryLvl = factory.level;
  }

  // #endregion Constructors (1)

  // #region Public Accessors (2)

  public get commodityTarget() {
    return this._commodityTarget;
  }

  public set commodityTarget(value) {
    this._commodityTarget = this.cache("_commodityTarget", value);
  }

  // #endregion Public Accessors (2)

  // #region Public Methods (4)

  public getCreateQue(
    resToProduce: FactoryResourceConstant,
    amountToCreate: number,
    factoryLevel = this.factory.level
  ): [CommodityConstant[], { [res in CommodityIngredient]?: number }] {
    // prob should precal for each resource
    const ingredients: { [res in CommodityIngredient]?: number } = {};
    const createQue: CommodityConstant[] = [];

    const decompressingResource = resToProduce in COMPRESS_MAP;

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
        (resource in COMPRESS_MAP && depth > 0) ||
        // we want to decompress some res so no need for more checks
        (decompressingResource && depth > 0)
      ) {
        addIngredient(resource, amountOfIngredient);
        return;
      }
      if (
        // something that we can't produce in this hive
        (recipe.level && recipe.level !== factoryLevel) ||
        // using lvl 0 of the chains from the network
        (!recipe.level &&
          resource !== resToProduce &&
          COMPLEX_COMMODITIES.includes(resource as CommodityConstant) &&
          Apiary.network.getResState(resource) >= amountOfIngredient)
      ) {
        addIngredient(resource, amountOfIngredient);
        return;
      }
      if (
        // can produce localy
        (!recipe.level || recipe.level === this.level) &&
        // target of production
        (resource === resToProduce ||
          // or we need to produce for next step
          this.hive.getUsedCapacity(resource as CommodityConstant) <
            amountOfIngredient)
      ) {
        if (
          // not already in que to produce
          createQue.indexOf(resource as CommodityConstant) === -1 &&
          // and have enought resources to produce
          !_.filter(
            recipe.components,
            (amountNeeded, component) =>
              this.hive.getUsedCapacity(component as CommodityIngredient) <
              amountNeeded
          ).length
        )
          // then add to que
          createQue.push(resource as CommodityConstant);
        // check all ingredients down the scream
        for (const component in recipe.components)
          dfs(
            component as CommodityIngredient,
            depth + 1,
            (amountOfIngredient *
              recipe.components[component as CommodityIngredient]) /
              recipe.amount
          );
      }
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
    if (recipe.level && this.level !== recipe.level) {
      if (Game.time % 50 === 0) this.prod = undefined; // the buff run out and new one didn't come
      return;
    }
    for (const r in recipe.components) {
      const res = r as CommodityConstant;
      const balance =
        recipe.components[res] - this.factory.store.getUsedCapacity(res);
      if (balance > 0) return;
    }
    const ans = this.factory.produce(this.prod.res);
    if (ans === OK) {
      this.prod.plan -= recipe.amount;
      if (this.commodityTarget && this.prod.res === this.commodityTarget.res)
        this.commodityTarget.amount -= recipe.amount;
      for (const r in recipe.components) {
        const res = r as FactoryResourceConstant;
        const amount = recipe.components[res];
        if (res in this.resTarget) this.resTarget[res]! -= amount;

        Apiary.logger.addResourceStat(this.hiveName, "factory", -amount, res);
      }

      Apiary.logger.addResourceStat(
        this.hiveName,
        "factory",
        COMMODITIES[this.prod.res].amount,
        this.prod.res
      );
    }
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

    if (this.hive.getResState(RESOURCE_ENERGY) < STOP_PRODUCTION) {
      if (this.prod && this.prod.res !== RESOURCE_ENERGY) {
        this.prod = undefined;
        this.commodityTarget = null;
      }
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
    if (fact < this.prod.plan) {
      if (this.patienceProd <= 10) ++this.patienceProd;
      else {
        this.prod.plan = fact;
        this.patienceProd = 0;
      }
    }
    if (this.prod.plan < recipe.amount || !this.commodityTarget)
      this.prod = undefined;
  }

  // #endregion Public Methods (4)

  // #region Private Methods (2)

  private newTarget() {
    // prev target is fine
    if (this.commodityTarget && this.commodityTarget.amount > 0) return OK;
    // dont produce
    if (
      !this.hive.mode.depositRefining ||
      (!this.commodityTarget && Apiary.intTime % COOLDOWN_TARGET_FACTORY !== 1)
    )
      return ERR_BUSY;

    this.uncommon = false;
    this.commodityTarget = null;
    let targets: { res: FactoryResourceConstant; amount: number }[] = [];
    let toCheck = Object.keys(COMMODITIES);
    if (this.hive.getResState(RESOURCE_ENERGY) < STOP_PRODUCTION)
      toCheck = [RESOURCE_ENERGY];

    for (const resToCheck of toCheck) {
      const res = resToCheck as FactoryResourceConstant; // actually ResourceConstant
      const recipe = COMMODITIES[res];
      if (recipe.level && recipe.level !== this.factory.level) continue;
      let num = 0;
      if (recipe.level || (COMPLEX_COMMODITIES as string[]).includes(res)) {
        // if it is from any of the chains of production

        const networkResAmount =
          (recipe.level !== Apiary.maxFactoryLvl &&
            Apiary.network.getResState(res)) ||
          0;
        // no need to overproduce the amount of stuff (demand driven production)
        // but produce max of the latest lvl
        if (networkResAmount >= STOCKPILE_HIGH_COMMODITIES) continue;

        num = 40;
        if ((COMMON_COMMODITIES as string[]).includes(res)) {
          const amountInUse = Apiary.network.getResState(
            res as CommodityConstant
          );
          if (amountInUse >= COMMON_COMMODITIES_STOCKPILE) num = 0;
        } else {
          const componentAmount: number[] = [];
          _.forEach(recipe.components, (amountNeeded, comp) => {
            const component = comp as FactoryResourceConstant | DepositConstant;
            if ((COMMON_COMMODITIES as string[]).includes(component)) return;
            if ((Object.values(COMPRESS_MAP) as string[]).includes(component)) {
              return;
            }
            let toUse = this.hive.getUsedCapacity(component);
            const networkAmount = Apiary.network.getResState(component);
            if (
              recipe.level ||
              networkAmount >= STOCKPILE_BASE_COMMODITIES.alot
            )
              toUse = Math.max(toUse, networkAmount);
            componentAmount.push(toUse / amountNeeded);
          });
          num = Math.min(num, ...componentAmount);
        }
      } else if (res === RESOURCE_ENERGY) {
        // energy below 100000
        const toProduce = -this.hive.getResState(res) + STOP_PRODUCTION * 1.2; // -resState -60_000
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
      }
      if (recipe.level && recipe.level !== this.level) {
        num = 0;
        this.uncommon = true; // ask for boost if not yet
      }
      if (num > 1)
        targets.push({ res, amount: Math.floor(num) * recipe.amount });
    }
    if (!targets.length) return ERR_NOT_FOUND;

    const nonCommon = targets.filter(
      (t) => !(COMMON_COMMODITIES as string[]).includes(t.res)
    );
    if (nonCommon.length) targets = nonCommon;
    this.patience = 0;
    const getlvlPriority = (cc: { res: FactoryResourceConstant }) =>
      (COMMON_COMMODITIES as string[]).includes(cc.res)
        ? -2
        : COMMODITIES[cc.res].level ||
          (cc.res in COMPRESS_MAP
            ? 5
            : 0 - _.filter(COMPRESS_MAP, (r) => r === cc.res).length);
    this.commodityTarget = targets.reduce((prev, curr) => {
      let ans = getlvlPriority(prev) - getlvlPriority(curr);
      if (ans === 0) ans = curr.amount - prev.amount;
      if (ans === 0)
        ans =
          this.hive.getUsedCapacity(curr.res) -
          this.hive.getUsedCapacity(prev.res);
      return ans < 0 ? curr : prev;
    });
    return OK;
  }

  private stepToTarget() {
    this.resTarget = { [RESOURCE_ENERGY]: FACTORY_ENERGY };
    if (this.newTarget() !== OK || !this.commodityTarget) return;

    const [createQue, ingredients] = this.getCreateQue(
      this.commodityTarget.res,
      this.commodityTarget.amount
    );

    _.forEach(ingredients, (amountNeeded, component) => {
      if (component === RESOURCE_ENERGY) amountNeeded += FACTORY_ENERGY;
      this.resTarget[component as CommodityIngredient] = Math.min(
        amountNeeded *
          ((COMPLEX_COMMODITIES as string[]).includes(
            component as CommodityIngredient
          )
            ? 1
            : 2),
        10000
      );
    });

    const recipeTarget = COMMODITIES[this.commodityTarget.res];
    this.uncommon = this.uncommon || !!recipeTarget.level;
    const amount =
      createQue.length &&
      this.newCommodity(
        createQue.reduce((prev, curr) =>
          this.hive.getUsedCapacity(curr) < this.hive.getUsedCapacity(prev)
            ? curr
            : prev
        ),
        this.commodityTarget.amount / recipeTarget.amount
      );
    if (amount) this.patience = 0;
    else ++this.patience;

    // @todo better patience system so no need to recreate que
    if (this.patience >= 100) {
      this.patience = 0;
      this.commodityTarget = null;
    }
  }

  // #endregion Private Methods (2)
}
