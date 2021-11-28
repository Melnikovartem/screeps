import { Cell } from "../_Cell";

import { prefix } from "../../enums";
import { findOptimalResource } from "../../abstract/utils";
import { BASE_MINERALS } from "./laboratoryCell";

import { profile } from "../../profiler/decorator";
import type { Hive } from "../../Hive";
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
}

export const COMMON_COMMODITIES: CommodityConstant[] = [RESOURCE_COMPOSITE, RESOURCE_CRYSTAL, RESOURCE_LIQUID];

/*
let ss = '"metal", "biomass", "silicon", "mist", ';
for (const r in COMMODITIES)
  if (Object.keys(COMMODITIES[<CommodityConstant>r].components).length > 2)
    ss += `"${r}", `;
console .log(`[ ${ss}]`)
*/

export const DEPOSIT_COMMODITIES: ResourceConstant[] = ["metal", "biomass", "silicon", "mist"];
export const COMMODITIES_TO_SELL: ResourceConstant[] = DEPOSIT_COMMODITIES.concat(["composite", "crystal", "liquid", "wire", "switch", "transistor", "microchip", "circuit", "device", "cell", "phlegm", "tissue", "muscle", "organoid", "organism", "alloy", "tube", "fixtures", "frame", "hydraulics", "machine", "condensate", "concentrate", "extract", "spirit", "emanation", "essence"]);

type CommodityIngredient = DepositConstant | CommodityConstant | MineralConstant | RESOURCE_ENERGY | RESOURCE_GHODIUM;

@profile
export class FactoryCell extends Cell {
  factory: StructureFactory;
  roomsToCheck: string[] = [];
  master: undefined;
  sCell: StorageCell;

  commodityRes?: CommodityConstant;
  prod?: { res: CommodityConstant, plan: number };
  resTarget: { [key in ResourceConstant]?: number } = {};
  patience: number = 0;
  patienceProd: number = 0;

  level: number = 0;

  possibleUncommon: boolean = false;

  constructor(hive: Hive, factory: StructureFactory, sCell: StorageCell) {
    super(hive, prefix.factoryCell + hive.room.name);
    this.sCell = sCell;
    this.factory = factory;
    // this.setCahe("commodityTarget", undefined);
  }

  get commodityTarget(): undefined | { res: CommodityConstant, amount: number } {
    return this.fromCache("commodityTarget");
  }

  set commodityTarget(value) {
    this.toCache("commodityTarget", value);
  }

  newCommodity(res: CommodityConstant, num: number): number {
    let recipe = COMMODITIES[res];
    num = Math.min(num, ..._.map(recipe.components, (amount, component) => Math.floor(this.sCell.getUsedCapacity(<CommodityIngredient>component) / amount)));
    if (num > 0)
      this.prod = {
        res: res,
        plan: num * recipe.amount,
      }
    return num;
  }

  stepToTarget() {
    this.resTarget = {};
    this.possibleUncommon = false;
    if (!this.commodityTarget || this.commodityTarget.amount <= 0) {
      this.commodityTarget = undefined;
      if (Game.time % 10 !== 8)
        return;
      let targets: { res: CommodityConstant, amount: number }[] = [];
      for (const r in COMMODITIES) {
        let res = <CommodityConstant>r; // atually ResourceConstant
        let recipe = COMMODITIES[res];
        if (recipe.level && recipe.level !== this.factory.level)
          continue;

        let num = 0;

        if (recipe.level || COMMODITIES_TO_SELL.includes(res)) {
          num = 40;
          if (!COMMON_COMMODITIES.includes(res)) {
            let componentAmount: number[] = [];
            _.forEach(recipe.components, (amount, component) => {
              if (COMMODITIES_TO_SELL.includes(<CommodityConstant>component)) {
                let toUse = this.sCell.getUsedCapacity(<CommodityConstant>component);
                if (recipe.level)
                  toUse = Math.max(toUse, Apiary.network.resState[<CommodityConstant>component] || 0);
                componentAmount.push(toUse / amount);
              }
            });
            num = Math.min(num, ...componentAmount);
            if (num > 1 && recipe.level)
              this.possibleUncommon = true;
          } else {
            let amountInUse = Apiary.network.resState[<CommodityConstant>res] || 0;
            if (amountInUse > 5000)
              num = 0;
          }
        } else if (res in this.hive.resState) {
          let balance = -this.hive.resState[res]! + (this.resTarget[res] || 0);
          num = balance / recipe.amount;
          if (BASE_MINERALS.includes(res) && num < -100) {
            num = 5;
            res = COMPRESS_MAP[<"H">res];
          }
        }
        if (num > 1)
          targets.push({ res: res, amount: Math.floor(num) * recipe.amount });
      }
      let nonCommon = targets.filter(t => !COMMON_COMMODITIES.includes(t.res));
      if (nonCommon.length)
        targets = nonCommon;
      if (!targets.length) {
        this.possibleUncommon = true;
        return;
      }
      this.patience = 0;
      this.commodityTarget = targets.reduce((prev, curr) => {
        let getlvlPriority = (cc: { res: CommodityConstant }) =>
          COMMON_COMMODITIES.includes(cc.res) ? -2 :
            (COMMODITIES[cc.res].level || (cc.res in COMPRESS_MAP ? 5 : (0 - _.filter(COMPRESS_MAP, r => r === cc.res).length)));
        let ans = getlvlPriority(prev) - getlvlPriority(curr);
        if (ans === 0)
          ans = curr.amount - prev.amount;
        if (ans === 0)
          ans = this.sCell.getUsedCapacity(curr.res) - this.sCell.getUsedCapacity(prev.res);
        return ans < 0 ? curr : prev;
      });
    }

    let [createQue, ingredients] = this.getCreateQue(this.commodityTarget.res, this.commodityTarget.amount);

    _.forEach(ingredients, (amount, component) => {
      this.resTarget[<CommodityIngredient>component] = Math.min(amount! * (COMMODITIES_TO_SELL.includes(<CommodityConstant>component) ? 1 : 2), 10000);
    });

    let recipe = COMMODITIES[this.commodityTarget.res];
    this.possibleUncommon = this.possibleUncommon || !!recipe.level;
    let amount = createQue.length && this.newCommodity(createQue.reduce(
      (prev, curr) => this.sCell.getUsedCapacity(curr) < this.sCell.getUsedCapacity(prev) ? curr : prev), this.commodityTarget.amount / recipe.amount);
    if (amount)
      this.patience = 0;
    else
      ++this.patience;

    if (this.patience >= 100) {
      this.patience = 0;
      this.commodityTarget = undefined;
    }
  }

  getCreateQue(res: CommodityConstant, amount: number, factoryLevel = this.factory.level): [CommodityConstant[], { [res in CommodityIngredient]?: number }] {
    // prob should precal for each resource
    let ingredients: { [res in CommodityIngredient]?: number } = {};
    let createQue: CommodityConstant[] = [];

    let baseResource = res in COMPRESS_MAP;
    let dfs = (resource: CommodityIngredient, depth: number, amount: number) => {
      let recipe = COMMODITIES[<CommodityConstant>resource];
      if (!recipe || (resource in COMPRESS_MAP && depth > 0) || (baseResource && depth > 0)) {
        ingredients[resource] = amount;
        return;
      }
      if (recipe.level && recipe.level !== factoryLevel) {
        ingredients[resource] = amount * recipe.amount;
        return;
      }
      createQue.push(<CommodityConstant>resource);
      for (const component in recipe.components)
        dfs(<CommodityIngredient>component, depth + 1, amount * recipe.components[<CommodityIngredient>component] / recipe.amount);
    }

    dfs(res, 0, amount);

    createQue = createQue.filter((value, index) => createQue.indexOf(value) === index);
    createQue = createQue.filter(res => {
      let recipe = COMMODITIES[res];
      return !_.filter(recipe.components, (amount, component) => this.sCell.getUsedCapacity(<CommodityIngredient>component) < amount).length
    });
    return [createQue, ingredients];
  }

  update() {
    super.update();
    this.roomsToCheck = this.hive.annexNames;

    this.level = 0;
    if (this.factory.effects) {
      let powerup = this.factory.effects.filter(e => e.effect === PWR_OPERATE_FACTORY && e.level === this.factory.level).length;
      if (powerup)
        this.level = this.factory.level;
    }

    let balance = this.factory.store.getUsedCapacity(RESOURCE_ENERGY) - FACTORY_ENERGY;
    if (balance < 1000)
      this.sCell.requestFromStorage([this.factory], 4, RESOURCE_ENERGY, -balance);
    if (!this.prod)
      this.stepToTarget();

    if (!this.prod) {
      for (const r in this.factory.store) {
        if (r === RESOURCE_ENERGY)
          continue;
        let res = <ResourceConstant>r;
        this.sCell.requestToStorage([this.factory], 5, res);
      }
      return;
    }
    let recipe = COMMODITIES[this.prod.res];
    for (const r in this.factory.store) {
      if (r === RESOURCE_ENERGY)
        continue;
      let res = <ResourceConstant>r;
      if (this.prod.res === res ? this.factory.store.getUsedCapacity(res) >= 5 * recipe.amount : !(res in recipe.components))
        this.sCell.requestToStorage([this.factory], this.factory.store.getFreeCapacity() < FACTORY_CAPACITY / 5 ? 3 : 5, res);
    }
    let fact = this.prod.plan;
    for (const r in recipe.components) {
      let res = <CommodityConstant>r;
      let amount = recipe.components[res];
      let balance = amount * this.prod.plan - this.factory.store.getUsedCapacity(res);
      if (this.factory.store.getUsedCapacity(res) < amount && balance > 0)
        this.sCell.requestFromStorage([this.factory], 4, res, Math.min(balance, FACTORY_CAPACITY / 10));
      fact = Math.min(fact, Math.floor(this.sCell.getUsedCapacity(res) / amount) * amount);
    }

    if (!this.factory.store.getFreeCapacity()) {
      let existing = this.sCell.requests[this.factory.id];
      if (!existing || existing.to.id !== this.sCell.storage.id)
        this.sCell.requestToStorage([this.factory], 3, findOptimalResource(this.factory.store), FACTORY_CAPACITY / 10);
    }
    if (fact < this.prod.plan) {
      if (this.patienceProd <= 10)
        ++this.patienceProd;
      else {
        this.prod.plan = fact;
        this.patienceProd = 0;
      }
    }
    if (this.prod.plan < recipe.amount || !this.commodityTarget)
      this.prod = undefined;
  }

  run() {
    if (!this.prod || this.factory.cooldown)
      return;
    let recipe = COMMODITIES[this.prod.res];
    if (recipe.level && this.level !== recipe.level) {
      this.prod = undefined;
      return;
    }
    for (const r in recipe.components) {
      let res = <CommodityConstant>r;
      let balance = recipe.components[res] - this.factory.store.getUsedCapacity(res)
      if (balance > 0)
        return;
    }
    let ans = this.factory.produce(this.prod.res);
    if (ans === OK) {
      this.prod.plan -= recipe.amount;
      if (this.commodityTarget && this.prod.res === this.commodityTarget.res)
        this.commodityTarget.amount -= recipe.amount;
      if (Apiary.logger) {
        for (const r in recipe.components) {
          let res = <CommodityConstant>r;
          let amount = recipe.components[res];
          Apiary.logger.addResourceStat(this.hive.roomName, "factory", -amount, res);
        }
        Apiary.logger.addResourceStat(this.hive.roomName, "factory", COMMODITIES[this.prod.res].amount, this.prod.res);
      }
    }
  }
}
