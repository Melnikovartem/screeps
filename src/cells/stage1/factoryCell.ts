import { findOptimalResource } from "../../abstract/utils";
import { prefix } from "../../enums";
import type { Hive } from "../../Hive";
import { profile } from "../../profiler/decorator";
import { Cell } from "../_Cell";
import type { StorageCell } from "./storageCell";

export const FACTORY_ENERGY = Math.round(FACTORY_CAPACITY * 0.16);
export const COMPRESS_MAP = {
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
export const COMMON_COMMODITIES: FactoryResourceConstant[] = [
  RESOURCE_COMPOSITE,
  RESOURCE_CRYSTAL,
  RESOURCE_LIQUID,
];

const STOP_PRODUCTION = -1000000;
/*
let ss = '"metal", "biomass", "silicon", "mist", ';
for (const r in COMMODITIES)
  if (Object.keys(COMMODITIES[<CommodityConstant>r].components).length > 2)
    ss += `"${r}", `;
console .log(`[ ${ss}]`)
*/

export const DEPOSIT_COMMODITIES: DepositConstant[] = [
  "metal",
  "biomass",
  "silicon",
  "mist",
];
export const COMMODITIES_TO_SELL = (
  DEPOSIT_COMMODITIES as (FactoryResourceConstant | DepositConstant)[]
).concat([
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
]);

type CommodityIngredient =
  | DepositConstant
  | CommodityConstant
  | MineralConstant
  | RESOURCE_ENERGY
  | RESOURCE_GHODIUM;

@profile
export class FactoryCell extends Cell {
  public factory: StructureFactory;
  public roomsToCheck: string[] = [];
  public master: undefined;
  public sCell: StorageCell;

  public commodityRes?: FactoryResourceConstant;
  public prod?: { res: FactoryResourceConstant; plan: number };
  public resTarget: { [key in ResourceConstant]?: number } = {};
  public patience: number = 0;
  public patienceProd: number = 0;

  public level: number = 0;

  public uncommon: boolean = false;

  public constructor(
    hive: Hive,
    factory: StructureFactory,
    sCell: StorageCell
  ) {
    super(hive, prefix.factoryCell + "_" + hive.room.name);
    this.sCell = sCell;
    this.factory = factory;
    // this.setCahe("commodityTarget", undefined);
  }

  public get commodityTarget():
    | undefined
    | { res: FactoryResourceConstant; amount: number } {
    return this.fromCache("commodityTarget");
  }

  public set commodityTarget(value) {
    this.toCache("commodityTarget", value);
  }

  public newCommodity(res: FactoryResourceConstant, num: number): number {
    const recipe = COMMODITIES[res];
    num = Math.min(
      num,
      ..._.map(recipe.components, (amount, component) =>
        Math.floor(
          this.sCell.getUsedCapacity(component as CommodityIngredient) / amount
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

  public stepToTarget() {
    this.resTarget = {};
    this.uncommon = false;
    if (!this.commodityTarget || this.commodityTarget.amount <= 0) {
      if (
        !this.hive.shouldDo("depositRefining") ||
        (!this.commodityTarget && Game.time % 25 !== 8)
      )
        return;
      this.commodityTarget = undefined;
      let targets: { res: FactoryResourceConstant; amount: number }[] = [];
      let toCheck = Object.keys(COMMODITIES);
      if (this.hive.resState[RESOURCE_ENERGY] < STOP_PRODUCTION)
        toCheck = [RESOURCE_ENERGY];

      for (const resToCheck of toCheck) {
        const res = resToCheck as FactoryResourceConstant; // atually ResourceConstant
        const recipe = COMMODITIES[res];
        if (recipe.level && recipe.level !== this.factory.level) continue;

        let num = 0;

        if (recipe.level || COMMODITIES_TO_SELL.includes(res)) {
          num = 40;
          if (!COMMON_COMMODITIES.includes(res)) {
            const componentAmount: number[] = [];
            _.forEach(recipe.components, (amountNeeded, component) => {
              if (
                COMMODITIES_TO_SELL.includes(component as CommodityConstant)
              ) {
                let toUse = this.sCell.getUsedCapacity(
                  component as CommodityConstant
                );
                if (recipe.level)
                  toUse = Math.max(
                    toUse,
                    Apiary.network.resState[component as CommodityConstant] || 0
                  );
                componentAmount.push(toUse / amountNeeded);
              }
            });
            num = Math.min(num, ...componentAmount);
            if (num > 1 && recipe.level) {
              this.uncommon = true;
              if (recipe.level !== this.level) num = 0;
            }
          } else {
            const amountInUse =
              Apiary.network.resState[res as CommodityConstant] || 0;
            if (amountInUse >= 5000) num = 0;
            else this.uncommon = true;
          }
        } else if (res === RESOURCE_ENERGY) {
          const balance =
            -(this.hive.resState[res] + 100000) + (this.resTarget[res] || 0);
          num = Math.ceil(balance / recipe.amount);
        }
        if (num > 1)
          targets.push({ res, amount: Math.floor(num) * recipe.amount });
      }
      const nonCommon = targets.filter(
        (t) => !COMMON_COMMODITIES.includes(t.res)
      );
      if (nonCommon.length) targets = nonCommon;
      if (!targets.length) return;
      this.patience = 0;
      const getlvlPriority = (cc: { res: FactoryResourceConstant }) =>
        COMMON_COMMODITIES.includes(cc.res)
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
            this.sCell.getUsedCapacity(curr.res) -
            this.sCell.getUsedCapacity(prev.res);
        return ans < 0 ? curr : prev;
      });
    }

    const [createQue, ingredients] = this.getCreateQue(
      this.commodityTarget.res,
      this.commodityTarget.amount
    );
    _.forEach(ingredients, (amountNeeded, component) => {
      this.resTarget[component as CommodityIngredient] = Math.min(
        amountNeeded *
          (COMMODITIES_TO_SELL.includes(component as CommodityConstant)
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
          this.sCell.getUsedCapacity(curr) < this.sCell.getUsedCapacity(prev)
            ? curr
            : prev
        ),
        this.commodityTarget.amount / recipeTarget.amount
      );
    if (amount) this.patience = 0;
    else ++this.patience;

    if (this.patience >= 100) {
      this.patience = 0;
      this.commodityTarget = undefined;
    }
  }

  public getCreateQue(
    res: FactoryResourceConstant,
    amountToCreate: number,
    factoryLevel = this.factory.level
  ): [CommodityConstant[], { [res in CommodityIngredient]?: number }] {
    // prob should precal for each resource
    const ingredients: { [res in CommodityIngredient]?: number } = {};
    const createQue: CommodityConstant[] = [];

    const baseResource = res in COMPRESS_MAP;
    const addIngredient = (
      resource: CommodityIngredient,
      amountToAdd: number
    ) => {
      if (!ingredients[resource]) ingredients[resource] = 0;
      ingredients[resource]! += amountToAdd;
    };
    const dfs = (
      resource: CommodityIngredient,
      depth: number,
      amountOfIngredient: number
    ) => {
      const recipe = COMMODITIES[resource as CommodityConstant];
      if (
        !recipe ||
        (resource in COMPRESS_MAP && depth > 0) ||
        (baseResource && depth > 0)
      ) {
        addIngredient(resource, amountOfIngredient);
        return;
      }
      if (
        (recipe.level && recipe.level !== factoryLevel) ||
        (!recipe.level &&
          resource !== res &&
          COMMODITIES_TO_SELL.includes(resource) &&
          (Apiary.network.resState[resource] || 0 >= amountOfIngredient))
      ) {
        addIngredient(resource, amountOfIngredient);
        return;
      }
      if (
        (!recipe.level || recipe.level === this.level) &&
        (resource === res ||
          this.sCell.getUsedCapacity(resource as CommodityConstant) <
            amountOfIngredient)
      ) {
        if (
          createQue.indexOf(resource as CommodityConstant) === -1 &&
          !_.filter(
            recipe.components,
            (amountNeeded, component) =>
              this.sCell.getUsedCapacity(component as CommodityIngredient) <
              amountNeeded
          ).length
        )
          createQue.push(resource as CommodityConstant);
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

    dfs(res, 0, amountToCreate);

    return [createQue, ingredients];
  }

  public update() {
    super.update();
    if (!this.factory) this.delete();

    this.roomsToCheck = this.hive.annexNames;

    this.level = 0;
    if (this.factory.effects) {
      const powerup = this.factory.effects.filter(
        (e) =>
          e.effect === PWR_OPERATE_FACTORY && e.level === this.factory.level
      ).length;
      if (powerup) this.level = this.factory.level!;
    }

    const balance =
      this.factory.store.getUsedCapacity(RESOURCE_ENERGY) - FACTORY_ENERGY;
    if (balance < 1000)
      this.sCell.requestFromStorage(
        [this.factory],
        4,
        RESOURCE_ENERGY,
        -balance
      );

    if (this.hive.resState[RESOURCE_ENERGY] < STOP_PRODUCTION) {
      if (this.prod && this.prod.res !== RESOURCE_ENERGY) {
        this.prod = undefined;
        this.commodityTarget = undefined;
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
      if (r === RESOURCE_ENERGY) continue;
      const res = r as ResourceConstant;
      if (
        this.prod.res === res
          ? this.factory.store.getUsedCapacity(res) >= 5 * recipe.amount
          : !(res in recipe.components)
      )
        this.sCell.requestToStorage(
          [this.factory],
          this.factory.store.getFreeCapacity() < FACTORY_CAPACITY / 5 ? 3 : 5,
          res
        );
    }
    let fact = this.prod.plan;
    for (const r in recipe.components) {
      const res = r as CommodityConstant;
      const amount = recipe.components[res];
      const balanceFree =
        amount * this.prod.plan - this.factory.store.getUsedCapacity(res);
      if (this.factory.store.getUsedCapacity(res) < amount && balanceFree > 0)
        this.sCell.requestFromStorage(
          [this.factory],
          4,
          res,
          Math.min(balanceFree, FACTORY_CAPACITY / 10)
        );
      fact = Math.min(
        fact,
        Math.floor(this.sCell.getUsedCapacity(res) / amount) * amount
      );
    }

    if (!this.factory.store.getFreeCapacity()) {
      const existing = this.sCell.requests[this.factory.id];
      if (!existing || existing.to.id !== this.sCell.storage.id)
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
        if (Apiary.logger)
          Apiary.logger.addResourceStat(
            this.hive.roomName,
            "factory",
            -amount,
            res
          );
      }
      if (Apiary.logger)
        Apiary.logger.addResourceStat(
          this.hive.roomName,
          "factory",
          COMMODITIES[this.prod.res].amount,
          this.prod.res
        );
    }
  }
}
