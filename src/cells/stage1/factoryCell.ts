import { Cell } from "../_Cell";

import { prefix } from "../../enums";

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

/*
let ss = '"metal", "biomass", "silicon", "mist", ';
for (const r in COMMODITIES)
  if (Object.keys(COMMODITIES[<CommodityConstant>r].components).length > 2)
    ss += `"${r}", `;
console.log(`[ ${ss}]`)
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
  lvl: 0 | 1 | 2 | 3 | 4 | 5 = 0;

  commodityRes?: CommodityConstant;
  prod?: { res: CommodityConstant, amount: number };
  resTarget: { [key in ResourceConstant]?: number } = {};
  patience: number = 0;

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
        amount: num * recipe.amount,
      }
    return num;
  }

  stepToTarget() {
    this.resTarget = {};
    if (!this.commodityTarget || this.commodityTarget.amount <= 0) {
      this.commodityTarget = undefined;
      if (Game.time % 25 !== 0)
        return;
      let targets: { res: CommodityConstant, amount: number }[] = [];
      for (const r in COMMODITIES) {
        let res = <CommodityConstant>r; // atually ResourceConstant
        let recipe = COMMODITIES[res];
        if (recipe.level && recipe.level > this.lvl)
          continue;
        let num = 0;
        if (res in this.hive.resState) {
          let balance = -this.hive.resState[res]! + (this.resTarget[res] || 0);
          num = balance / recipe.amount;
        }
        if (Object.keys(recipe.components).length > 2 && num < 1) {
          let components = _.map(recipe.components, (amount, component) =>
            COMMODITIES_TO_SELL.includes(<CommodityConstant>component)
              ? this.sCell.getUsedCapacity(<CommodityConstant>component) / amount : Infinity);
          num = Math.min(25, ...components);
        }
        if (num > 1)
          targets.push({ res: res, amount: Math.floor(num) * recipe.amount });
      }
      if (!targets.length)
        return;
      this.patience = 0;
      targets.sort((a, b) => b.amount - a.amount);
      this.commodityTarget = targets[0];
    }

    let [createQue, ingredients] = this.getCreateQue(this.commodityTarget.res);

    _.forEach(ingredients, (amount, component) => {
      this.resTarget[<CommodityIngredient>component] = amount! * (COMMODITIES_TO_SELL.includes(<CommodityConstant>component) ? 1 : 2);
    });

    let recipe = COMMODITIES[this.commodityTarget.res];
    let amount = createQue.length && this.newCommodity(createQue.reduce(
      (prev, curr) => this.sCell.getUsedCapacity(curr) < this.sCell.getUsedCapacity(prev) ? curr : prev), this.commodityTarget.amount / recipe.amount);
    if (amount)
      this.patience = 0;
    else
      ++this.patience;

    if (this.patience > 256) {
      this.patience = 0;
      this.commodityTarget = undefined;
    }
  }

  getCreateQue(res: CommodityConstant): [CommodityConstant[], { [res in CommodityIngredient]?: number }] {
    // prob should precal for each resource
    let ingredients: { [res in CommodityIngredient]?: number } = {};
    let createQue: CommodityConstant[] = [];

    let dfs = (resource: CommodityIngredient, depth: number) => {
      let recipe = COMMODITIES[<CommodityConstant>resource];
      if (!recipe || (resource in COMPRESS_MAP && depth > 0)) {
        ingredients[resource] = 0;
        return;
      }
      if (!(res in COMPRESS_MAP) || !depth)
        createQue.push(<CommodityConstant>resource);
      for (const component in recipe.components)
        dfs(<CommodityIngredient>component, depth + 1);
    }

    dfs(res, 0);

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

    let powerup = this.factory.effects && <PowerEffect>this.factory.effects.filter(p => p.effect === PWR_OPERATE_FACTORY)[0];
    if (powerup)
      this.lvl = <FactoryCell["lvl"]>powerup.level;
    else
      this.lvl = 0;

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
        this.sCell.requestToStorage([this.factory], 5, res);
    }
    for (const r in recipe.components) {
      let res = <CommodityConstant>r;
      let amount = recipe.components[res];
      let balance = amount * this.prod.amount - this.factory.store.getUsedCapacity(res);
      if (this.factory.store.getUsedCapacity(res) < amount && balance > 0)
        this.sCell.requestFromStorage([this.factory], 4, res, balance);
      this.prod.amount = Math.min(this.prod.amount, Math.floor(this.sCell.getUsedCapacity(res) / amount) * amount);
    }
    if (this.prod.amount <= 0 || this.commodityTarget && this.commodityTarget.amount <= 0)
      this.prod = undefined;
  }

  run() {
    if (!this.prod || this.factory.cooldown)
      return;
    let recipe = COMMODITIES[this.prod.res];
    for (const r in recipe.components) {
      let res = <CommodityConstant>r;
      let balance = recipe.components[res] - this.factory.store.getUsedCapacity(res)
      if (balance > 0)
        return;
    }
    if (this.factory.produce(this.prod.res) === OK) {
      this.prod.amount -= recipe.amount;
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
