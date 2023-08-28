import {
  ApiaryReturnCode,
  ERR_COOLDOWN,
  ERR_INVALID_ACTION,
} from "static/constants";

import type { Bee } from "../../bees/bee";
import type { Hive } from "../../hive/hive";
import { profile } from "../../profiler/decorator";
import { hiveStates, prefix } from "../../static/enums";
import { Cell } from "../_Cell";

export type ReactionConstant =
  | "G"
  | "OH"
  | "ZK"
  | "UL"
  | "LH"
  | "ZH"
  | "GH"
  | "KH"
  | "UH"
  | "LO"
  | "ZO"
  | "KO"
  | "UO"
  | "GO"
  | "LH2O"
  | "KH2O"
  | "ZH2O"
  | "UH2O"
  | "GH2O"
  | "LHO2"
  | "UHO2"
  | "KHO2"
  | "ZHO2"
  | "GHO2"
  | "XUH2O"
  | "XUHO2"
  | "XKH2O"
  | "XKHO2"
  | "XLH2O"
  | "XLHO2"
  | "XZH2O"
  | "XZHO2"
  | "XGH2O"
  | "XGHO2";
export type BoostType =
  | "harvest"
  | "build"
  | "dismantle"
  | "upgrade"
  | "attack"
  | "rangedAttack"
  | "heal"
  | "capacity"
  | "fatigue"
  | "damage";

export const BOOST_MINERAL: {
  [key in BoostType]: [ReactionConstant, ReactionConstant, ReactionConstant];
} = {
  attack: ["UH", "UH2O", "XUH2O"],
  harvest: ["UO", "UHO2", "XUHO2"],
  capacity: ["KH", "KH2O", "XKH2O"],
  rangedAttack: ["KO", "KHO2", "XKHO2"],
  build: ["LH", "LH2O", "XLH2O"],
  heal: ["LO", "LHO2", "XLHO2"],
  dismantle: ["ZH", "ZH2O", "XZH2O"],
  fatigue: ["ZO", "ZHO2", "XZHO2"],
  upgrade: ["GH", "GH2O", "XGH2O"],
  damage: ["GO", "GHO2", "XGHO2"],
};
export const BOOST_PARTS: { [key in BoostType]: BodyPartConstant } = {
  harvest: WORK,
  build: WORK,
  dismantle: WORK,
  upgrade: WORK,
  attack: ATTACK,
  rangedAttack: RANGED_ATTACK,
  heal: HEAL,
  capacity: CARRY,
  fatigue: MOVE,
  damage: TOUGH,
};

export const USEFUL_MINERAL_STOCKPILE: { [key in ReactionConstant]?: number } =
  {
    [BOOST_MINERAL.attack[2]]: 40000,
    [BOOST_MINERAL.harvest[2]]: 3000,
    [BOOST_MINERAL.capacity[2]]: 3000,
    [BOOST_MINERAL.rangedAttack[2]]: 40000,
    [BOOST_MINERAL.build[2]]: 40000,
    [BOOST_MINERAL.heal[2]]: 40000,
    [BOOST_MINERAL.dismantle[2]]: 40000,
    [BOOST_MINERAL.fatigue[2]]: 40000,
    [BOOST_MINERAL.upgrade[2]]: 40000,
    [BOOST_MINERAL.damage[2]]: 40000,
  };

const PRODUCE_PER_BATCH = 2500;

export const BASE_MINERALS: ResourceConstant[] = [
  "H",
  "K",
  "L",
  "U",
  "X",
  "O",
  "Z",
];
export const REACTION_MAP: {
  [key in ReactionConstant | MineralConstant]?: {
    res1: ReactionConstant | MineralConstant;
    res2: ReactionConstant | MineralConstant;
  };
} = {};
for (const res1 in REACTIONS) {
  for (const res2 in REACTIONS[res1])
    REACTION_MAP[REACTIONS[res1][res2] as ReactionConstant | MineralConstant] =
      {
        res1: res1 as ReactionConstant | MineralConstant,
        res2: res2 as ReactionConstant | MineralConstant,
      };
}

// reaction map done

interface SynthesizeRequest {
  plan: number;
  res: ReactionConstant;
  res1: ReactionConstant | MineralConstant;
  res2: ReactionConstant | MineralConstant;
  cooldown: number;
}

export interface BoostRequest {
  type: BoostType;
  amount?: number;
  lvl: 0 | 1 | 2;
}
export interface BoostInfo {
  type: BoostType;
  res: ReactionConstant;
  amount: number;
  lvl: 0 | 1 | 2;
}
type LabState =
  | "idle"
  | "production"
  | "source"
  | "unboosted"
  | ReactionConstant;

const COOLDOWN_TARGET_LAB = 1000;

@profile
export class LaboratoryCell extends Cell {
  public laboratories: { [id: string]: StructureLab } = {};
  // inLab check for delivery system
  public master: undefined;

  public synthesizeRes: SynthesizeRequest | undefined;
  public resTarget: { [key in ResourceConstant]?: number } = {};
  public prod?: SynthesizeRequest & { lab1: string; lab2: string };
  private patience: number = 0;
  private patienceProd: number = 0;
  private prodCooldown = 0;
  private usedBoost: string[] = [];

  private positions: RoomPosition[] = [];
  /** if nothing to create we take a break for COOLDOWN_TARGET_LAB ticks */
  private targetCooldown = Game.time;

  public constructor(hive: Hive) {
    super(hive, prefix.laboratoryCell);
  }

  private get sCell() {
    return this.hive.cells.storage!;
  }

  public poss: { x: number; y: number } = this.cache("poss") || {
    x: 25,
    y: 25,
  };
  public get pos(): RoomPosition {
    return new RoomPosition(this.poss.x, this.poss.y, this.roomName);
  }

  public _labStates: { [id: string]: LabState } =
    this.cache("_labStates") || {};
  public get labStates(): { [id: string]: LabState } {
    return this._labStates;
  }
  public set labStates(value) {
    this._labStates = this.cache("labStates", value);
  }

  public _boostLabs: { [key in ResourceConstant]?: string } =
    this.cache("_boostLabs") || {};
  public get boostLabs() {
    return this._boostLabs;
  }
  public set boostLabs(value) {
    this._boostLabs = this.cache("_boostLabs", value);
  }

  public _boostRequests: {
    [id: string]: { info: BoostInfo[]; lastUpdated: number };
  } = this.cache("_boostRequests") || {};
  public get boostRequests() {
    return this._boostRequests;
  }
  public set boostRequests(value) {
    this._boostRequests = this.cache("_boostRequests", value);
  }

  public _synthesizeTarget:
    | undefined
    | { res: ReactionConstant; amount: number } =
    this.cache("_synthesizeTarget") || undefined;
  public get synthesizeTarget() {
    return this._synthesizeTarget;
  }
  public set synthesizeTarget(value) {
    this._synthesizeTarget = this.cache("_synthesizeTarget", value);
  }

  public bakeMap() {
    this.positions = [];
    _.forEach(this.laboratories, (l) => {
      _.forEach(l.pos.getOpenPositions(true), (p) => {
        if (!this.positions.filter((pp) => pp.x === p.x && pp.y === p.y).length)
          this.positions.push(p);
      });
    });
  }

  private newSynthesize(
    resource: ReactionConstant,
    amount: number = Infinity
  ): number {
    if (!(resource in REACTION_TIME)) return 0;
    const res1Amount = this.sCell.getUsedCapacity(REACTION_MAP[resource]!.res1);
    const res2Amount = this.sCell.getUsedCapacity(REACTION_MAP[resource]!.res2);
    amount = Math.min(amount, res1Amount, res2Amount);
    if (amount > 0)
      this.synthesizeRes = {
        plan: amount,
        res: resource,
        res1: REACTION_MAP[resource]!.res1,
        res2: REACTION_MAP[resource]!.res2,
        cooldown: REACTION_TIME[resource],
      };
    return amount;
  }

  private getNewTarget(ignorePrevTarget: boolean): ApiaryReturnCode {
    if (this.synthesizeTarget && !ignorePrevTarget) return OK;
    if (Game.time < this.targetCooldown) return ERR_COOLDOWN;
    const mode = this.hive.shouldDo("lab");
    if (!mode) return ERR_INVALID_ACTION;
    let targets: { res: ReactionConstant; amount: number }[] = [];
    for (const r in this.hive.resState) {
      const res = r as ReactionConstant; // catually ResourceConstant
      const toCreate = -this.hive.resState[res]!;
      if (toCreate > 0 && res in REACTION_MAP)
        targets.push({ res, amount: toCreate });
    }
    const canCreate = targets.filter(
      (t) => this.getCreateQue(t.res, t.amount)[0].length
    );
    if (canCreate.length) targets = canCreate;
    if (!targets.length) {
      if (mode === 1) return ERR_NOT_FOUND;
      // not eve gonna try to create mid ones (not profitable)
      let usefulR: ReactionConstant[] = [];

      for (const comp of Object.keys(USEFUL_MINERAL_STOCKPILE)) {
        const compound: ReactionConstant = comp as ReactionConstant;
        if (
          USEFUL_MINERAL_STOCKPILE[compound]! -
            (this.hive.resState[compound] || 0) >
          0
        )
          usefulR.push(compound);
      }
      if (!usefulR.length) usefulR = Apiary.broker.profitableCompounds;
      if (!usefulR.length) return ERR_NOT_FOUND;
      targets = [
        {
          res: usefulR.reduce((prev, curr) =>
            (Apiary.network.resState[curr] || 0) <
            (Apiary.network.resState[prev] || 0)
              ? curr
              : prev
          ),
          amount: PRODUCE_PER_BATCH,
        },
      ];
      // targets = [{ res: usefulM[Math.floor(Math.random() * usefulM.length)], amount: 2048 }];
    }
    this.patience = 0;
    targets.sort((a, b) => b.amount - a.amount);
    this.synthesizeTarget = targets[0];
    this.synthesizeTarget.amount = Math.max(
      Math.min(this.synthesizeTarget.amount, LAB_MINERAL_CAPACITY * 2),
      LAB_MINERAL_CAPACITY / 3
    );
    return OK;
  }

  private stepToTarget() {
    this.resTarget = {};
    if (this.getNewTarget(false) !== OK || !this.synthesizeTarget) return;

    const [createQue, ingredients] = this.getCreateQue(
      this.synthesizeTarget.res,
      this.synthesizeTarget.amount
    );

    _.forEach(
      ingredients,
      (resource) => (this.resTarget[resource] = this.synthesizeTarget!.amount)
    );
    const amount =
      createQue.length &&
      this.newSynthesize(
        createQue.reduce((prev, curr) =>
          this.sCell.getUsedCapacity(curr) < this.sCell.getUsedCapacity(prev)
            ? curr
            : prev
        ),
        this.synthesizeTarget.amount
      );
    if (amount) this.patience = 0;
    else ++this.patience;

    if (this.patience >= 100) {
      this.patience = 0;
      this.synthesizeTarget = undefined;
    }
  }

  private getCreateQue(
    res: ReactionConstant,
    amount: number
  ): [ReactionConstant[], MineralConstant[]] {
    // prob should precal for each resource
    const ingredients: MineralConstant[] = [];
    const createQue: ReactionConstant[] = [];

    const dfs = (resource: ReactionConstant) => {
      const recipe = REACTION_MAP[resource];
      if (!recipe) {
        if (
          this.sCell.getUsedCapacity(resource) < amount &&
          ingredients.indexOf(resource as MineralConstant) === -1
        )
          ingredients.push(resource as MineralConstant);
        return;
      }
      const needed =
        resource === res
          ? amount
          : amount - this.sCell.getUsedCapacity(resource);
      if (needed > 0) {
        if (
          createQue.indexOf(resource) === -1 &&
          this.sCell.getUsedCapacity(recipe.res1) >=
            Math.min(needed, LAB_MINERAL_CAPACITY / 3) &&
          this.sCell.getUsedCapacity(recipe.res2) >=
            Math.min(needed, LAB_MINERAL_CAPACITY / 3)
        )
          createQue.push(resource);
        dfs(recipe.res1 as ReactionConstant);
        dfs(recipe.res2 as ReactionConstant);
      }
    };

    dfs(res);

    return [createQue, ingredients];
  }

  private newProd() {
    if (!this.synthesizeRes) return false;

    const res1 = this.synthesizeRes.res1;
    const res2 = this.synthesizeRes.res2;

    const prodAmount: { [id: string]: number } = {};
    for (const id in this.laboratories)
      prodAmount[id] = _.filter(
        this.laboratories,
        (l) => this.laboratories[id].pos.getRangeTo(l) <= 2
      ).length;
    const comp = (
      prev: StructureLab,
      curr: StructureLab,
      res: MineralConstant | ReactionConstant
    ) => {
      let cond = prodAmount[prev.id] - prodAmount[curr.id];
      if (cond === 0)
        cond =
          prev.store.getUsedCapacity(res) - curr.store.getUsedCapacity(res);
      if (cond === 0)
        cond =
          curr.pos.getTimeForPath(this.sCell) -
          prev.pos.getTimeForPath(this.sCell);
      return cond < 0 ? curr : prev;
    };

    const lab1 = _.map(this.laboratories, (l) => l).reduce((prev, curr) =>
      comp(prev, curr, res1)
    );
    let lab2: StructureLab | undefined;
    if (lab1)
      lab2 = _.filter(this.laboratories, (l) => l.id !== lab1.id).reduce(
        (prev, curr) => comp(prev, curr, res2)
      );
    if (
      lab1 &&
      lab2 &&
      _.filter(
        this.laboratories,
        (l) =>
          l.id !== lab1.id &&
          l.id !== lab2!.id &&
          l.cooldown <= this.synthesizeRes!.cooldown
      ).length
    ) {
      this.prod = { ...this.synthesizeRes, lab1: lab1.id, lab2: lab2.id };
      this.prodCooldown = 0;
      this.labStates[lab1.id] = "source";
      this.updateLabState(lab1, 1);
      this.labStates[lab2.id] = "source";
      this.updateLabState(lab2, 1);
      this.synthesizeRes = undefined;
    }
    return true;
  }

  public getBoostInfo(
    r: BoostRequest,
    bee?: Bee,
    boostedSameType?: number
  ): BoostInfo | void {
    const res = BOOST_MINERAL[r.type][r.lvl];
    let sum = this.sCell.getUsedCapacity(res);
    if (bee && this.prod && res === this.prod.res) {
      sum = this.sCell.storage.store.getUsedCapacity(res);
      const inBees = _.sum(this.sCell.master.activeBees, (b) =>
        b.store.getUsedCapacity(res)
      );
      if (inBees) sum += inBees;
      const boostLab = this.boostLabs[res];
      if (boostLab)
        sum += this.laboratories[boostLab].store.getUsedCapacity(res);
    }
    let amount = r.amount || Infinity;
    amount = Math.min(amount, Math.floor(sum / LAB_BOOST_MINERAL));
    if (bee) {
      if (!boostedSameType) boostedSameType = 0;
      amount =
        Math.min(
          amount - bee.getBodyParts(BOOST_PARTS[r.type], 1),
          bee.getBodyParts(BOOST_PARTS[r.type], -1)
        ) - boostedSameType;
    }
    if (amount <= 0) return;
    return { type: r.type, res, amount, lvl: r.lvl };
  }

  // lowLvl : 0 - tier 3 , 1 - tier 2+, 2 - tier 1+
  public askForBoost(bee: Bee, requests?: BoostRequest[]) {
    let rCode: ScreepsReturnCode = OK;

    if (bee.ticksToLive < 1000)
      // || bee.pos.roomName !== this.pos.roomName)
      return rCode;

    if (!requests) {
      requests = bee.master && bee.master.boosts;
      if (!requests) return rCode;
    }

    if (
      !this.boostRequests[bee.ref] ||
      Game.time >= this.boostRequests[bee.ref].lastUpdated + 25
    ) {
      this.boostRequests[bee.ref] = { info: [], lastUpdated: Game.time };
      for (const r of requests) {
        const sameType = _.sum(
          this.boostRequests[bee.ref].info.filter((br) => br.type === r.type),
          (br) => br.amount
        );
        const ans = this.getBoostInfo(r, bee, sameType);
        if (ans) this.boostRequests[bee.ref].info.push(ans);
      }
    }

    for (const r of this.boostRequests[bee.ref].info) {
      let lab: StructureLab | undefined;

      if (!r.res || !r.amount) continue;

      const boostLabId = this.boostLabs[r.res];
      if (boostLabId) {
        if (this.labStates[boostLabId] !== r.res)
          this.boostLabs[r.res] = undefined;
        else lab = this.laboratories[boostLabId];
      }

      if (!lab) {
        const getLab = (state?: LabState, sameMineral = true) => {
          const labs = _.filter(this.laboratories, (l) => {
            const currState = this.labStates[l.id];
            return (
              (!sameMineral || l.mineralType === r.res) &&
              ((!state && currState !== "source") || currState === state)
            );
          });
          if (labs.length)
            return labs.reduce((prev, curr) =>
              curr.pos.getRangeTo(this.sCell) < prev.pos.getRangeTo(this.sCell)
                ? curr
                : prev
            );
          return undefined;
        };
        if (this.prod)
          switch (r.res) {
            case this.prod.res1:
              lab = this.laboratories[this.prod.lab1];
              break;
            case this.prod.res2:
              lab = this.laboratories[this.prod.lab2];
              break;
            case this.prod.res:
              lab = getLab("production", false);
              break;
          }
        if (!lab) lab = getLab(); // any lab same mineral
        if (!lab) lab = getLab("production", false);
        if (!lab) lab = getLab("idle", false);
        if (!lab) lab = getLab("unboosted", false);
        if (!lab) lab = getLab("source", false);
        if (lab) {
          this.boostLabs[r.res] = lab.id;
          this.labStates[lab.id] = r.res;
        }
      }

      if (!lab) {
        if (rCode === OK && Object.keys(this.laboratories).length)
          rCode = ERR_TIRED;
        continue;
      }

      if (bee.creep.spawning) {
        rCode = ERR_BUSY;
        continue;
      }

      if (
        lab.store.getUsedCapacity(r.res) >= r.amount * LAB_BOOST_MINERAL &&
        lab.store.getUsedCapacity(RESOURCE_ENERGY) >=
          r.amount * LAB_BOOST_ENERGY &&
        !this.usedBoost.includes(lab.id)
      ) {
        const pos = lab.pos.getOpenPositions(true)[0];
        if (bee.pos.isNearTo(lab)) {
          const ans = lab.boostCreep(bee.creep, r.amount);
          this.usedBoost.push(lab.id);
          if (ans === OK) {
            bee.boosted = true;
            if (Apiary.logger) {
              Apiary.logger.addResourceStat(
                this.roomName,
                "boosts",
                -r.amount * LAB_BOOST_MINERAL,
                r.res
              );
              Apiary.logger.addResourceStat(
                this.roomName,
                "boosts",
                -r.amount * LAB_BOOST_ENERGY,
                RESOURCE_ENERGY
              );
            }
            r.amount = 0;
          }
        } else if (rCode !== ERR_NOT_IN_RANGE) {
          bee.goTo(pos);
          rCode = ERR_NOT_IN_RANGE;
        }
      } else if (this.hive.state === hiveStates.lowenergy) continue; // help is not coming
      if (rCode !== ERR_NOT_IN_RANGE) rCode = ERR_TIRED;
      continue;
    }

    if (rCode === ERR_TIRED) bee.goRest(this.pos);
    else if (rCode === OK) delete this.boostRequests[bee.ref];
    return rCode;
  }

  private updateLabState(l: StructureLab, rec = 0) {
    switch (rec) {
      // max recursion = 2 just to be safe i count
      default:
        return;
      case 1:
        delete this.sCell.requests[l.id];
        break;
      case 0:
        break;
    }
    const state = this.labStates[l.id];
    switch (state) {
      case "unboosted": {
        const resources = l.pos.findInRange(FIND_DROPPED_RESOURCES, 1);
        this.sCell.requestToStorage(resources, 2, undefined);
        if (Apiary.logger)
          _.forEach(resources, (r) =>
            Apiary.logger!.addResourceStat(
              this.roomName,
              "unboost",
              r.amount,
              r.resourceType
            )
          );
        // falls through
      }
      case undefined:
        this.labStates[l.id] = "idle";
      // falls through
      case "idle":
        if (this.prod) {
          if (l.id === this.prod.lab1 || l.id === this.prod.lab2) {
            this.labStates[l.id] = "source";
            this.updateLabState(l, rec + 1);
          } else if (
            l.cooldown <= this.prod.cooldown &&
            l.pos.getRangeTo(this.laboratories[this.prod.lab1]) <= 2 &&
            l.pos.getRangeTo(this.laboratories[this.prod.lab1]) <= 2
          ) {
            this.labStates[l.id] = "production";
            this.updateLabState(l, rec + 1);
          } else if (l.mineralType)
            this.sCell.requestToStorage([l], 5, l.mineralType);
        } else if (l.mineralType)
          this.sCell.requestToStorage([l], 5, l.mineralType);
        break;
      case "source": {
        if (!this.prod) {
          this.labStates[l.id] = "idle";
          this.updateLabState(l, rec + 1);
          break;
        }
        let r: ReactionConstant | MineralConstant;
        if (l.id === this.prod.lab1) {
          r = this.prod.res1;
        } else if (l.id === this.prod.lab2) {
          r = this.prod.res2;
        } else {
          this.labStates[l.id] = "idle";
          this.updateLabState(l, rec + 1);
          break;
        }
        const freeCap = l.store.getFreeCapacity(r);
        if (l.mineralType && l.mineralType !== r)
          this.sCell.requestToStorage([l], 3, l.mineralType);
        else if (
          (freeCap > LAB_MINERAL_CAPACITY / 2 ||
            this.prod.plan <= LAB_MINERAL_CAPACITY) &&
          l.store.getUsedCapacity(r) < this.prod.plan
        )
          this.sCell.requestFromStorage([l], 3, r, this.prod.plan);
        break;
      }
      case "production": {
        const res = l.mineralType;
        if (!this.prod || l.cooldown > this.prod.cooldown * 2) {
          this.labStates[l.id] = "idle";
          this.updateLabState(l, rec + 1);
          break;
        } else if (
          res &&
          (res !== this.prod.res ||
            l.store.getUsedCapacity(res) >= LAB_MINERAL_CAPACITY / 2)
        )
          this.sCell.requestToStorage(
            [l],
            4,
            res,
            l.store.getUsedCapacity(res)
          );
        break;
      }
      default: {
        // boosting lab : state === resource
        const toBoostMinerals = _.sum(this.boostRequests, (br) => {
          const sameType = br.info.filter(
            (r) => r.res === this.labStates[l.id]
          );
          return _.sum(sameType, (r) => r.amount * LAB_BOOST_MINERAL);
        });
        if (!toBoostMinerals) {
          this.labStates[l.id] = "idle";
          if (this.boostLabs[state] === l.id) this.boostLabs[state] = undefined;
          this.updateLabState(l, rec + 1);
          return;
        }
        if (l.mineralType && l.mineralType !== state)
          this.sCell.requestToStorage([l], 1, l.mineralType);
        else if (l.store.getUsedCapacity(state) < toBoostMinerals)
          this.sCell.requestFromStorage(
            [l],
            1,
            state,
            toBoostMinerals - l.store.getUsedCapacity(state),
            true
          );
        break;
      }
    }
  }

  public update() {
    super.update(["laboratories"]);
    if (!Object.keys(this.laboratories).length) return;

    let priority = 5 as 2 | 5;
    this.sCell.requestFromStorage(
      _.filter(this.laboratories, (l) => {
        if (
          l.store.getUsedCapacity(RESOURCE_ENERGY) <
          LAB_ENERGY_CAPACITY * 0.5
        )
          priority = 2;
        return l.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }),
      priority,
      RESOURCE_ENERGY,
      LAB_ENERGY_CAPACITY,
      true
    );

    for (const id in this.laboratories) {
      this.updateLabState(this.laboratories[id]);
    }

    this.usedBoost = [];

    let prev;
    for (const id in this.laboratories) {
      const curr = this.sCell.requests[id];
      if (curr && curr.to.id === this.sCell.storage.id) {
        curr.nextup = prev;
        prev = curr;
      }
    }

    if (
      !this.prod &&
      (Object.keys(this.laboratories).length < 3 ||
        _.filter(this.laboratories, (l) => !l.cooldown).length < 1) &&
      !this.newProd()
    ) {
      this.stepToTarget();
      // chill if nothing to produce
      if (!this.synthesizeTarget && Game.time >= this.targetCooldown)
        this.targetCooldown = Game.time + COOLDOWN_TARGET_LAB;
      this.newProd();
    }

    if (this.prod) {
      const fact = Math.min(
        this.prod.plan,
        this.sCell.getUsedCapacity(this.prod.res1),
        this.sCell.getUsedCapacity(this.prod.res2)
      );
      if (fact < this.prod.plan) {
        if (this.patienceProd <= 10) ++this.patienceProd;
        else {
          this.prod.plan = fact;
          this.patienceProd = 0;
        }
      }
      if (this.synthesizeTarget && this.synthesizeTarget.amount < 15)
        this.synthesizeTarget = undefined;
      if (this.prod.plan < 15 || !this.synthesizeTarget) this.prod = undefined;
    }

    for (const ref in this.boostRequests)
      if (this.boostRequests[ref].lastUpdated + 25 < Game.time)
        delete this.boostRequests[ref];
  }

  public getUnboostLab(ticksToLive: number) {
    if (!this.hive.shouldDo("unboost")) return undefined;
    let lab: StructureLab | undefined;
    _.some(this.laboratories, (l) => {
      if (l.cooldown > ticksToLive) return false;
      lab = l;
      return true;
    });
    return lab;
  }

  public run() {
    if (this.hive.shouldDo("unboost")) {
      const creepsToUnboost: Creep[] = [];
      const time = Math.max(10000, (this.prod && this.prod.cooldown * 2) || 0);
      _.forEach(this.positions, (p) => {
        const creep = p
          .lookFor(LOOK_CREEPS)
          .filter(
            (c) =>
              c.ticksToLive &&
              c.ticksToLive < time &&
              c.body.filter((b) => b.boost).length
          )[0];
        if (creep) creepsToUnboost.push(creep);
      });
      _.forEach(creepsToUnboost, (creep) => {
        const lab = _.filter(
          this.laboratories,
          (l) =>
            !l.cooldown &&
            l.pos.getRangeTo(creep) <= 1 &&
            this.labStates[l.id] !== "unboosted"
        )[0];
        if (lab && lab.unboostCreep(creep) === OK) {
          this.labStates[lab.id] = "unboosted";
          const bee = Apiary.bees[creep.name] as Bee;
          if (bee) bee.boosted = false;
        }
      });
    }

    --this.prodCooldown;
    if (this.prod && this.prodCooldown <= 0 && this.prod.plan > 0) {
      const lab1 = this.laboratories[this.prod.lab1];
      const lab2 = this.laboratories[this.prod.lab2];
      const amount = Math.min(
        lab1.store[this.prod.res1],
        lab2.store[this.prod.res2]
      );
      if (amount >= 15) {
        const labs = _.filter(
          this.laboratories,
          (lab) =>
            lab.store.getFreeCapacity(this.prod!.res) >= 5 &&
            !lab.cooldown &&
            (this.labStates[lab.id] === "production" ||
              this.labStates[lab.id] === this.prod!.res)
        );
        let cc = 0;
        for (let k = 0; k < labs.length && amount >= cc; ++k) {
          const lab = labs[k];
          const ans = lab.runReaction(lab1, lab2);
          if (ans === OK) {
            let produced = 5;
            const powerup =
              lab.effects &&
              (lab.effects.filter(
                (p) => p.effect === PWR_OPERATE_LAB
              )[0] as PowerEffect);
            if (powerup) produced += powerup.level * 2;
            cc += produced;
          }
        }
        if (cc) this.prodCooldown = this.prod.cooldown;
        if (
          this.synthesizeTarget &&
          this.prod.res === this.synthesizeTarget.res
        )
          this.synthesizeTarget.amount -= cc;
        this.prod.plan -= cc;
        if (Apiary.logger) {
          Apiary.logger.addResourceStat(
            this.roomName,
            "labs",
            cc,
            this.prod.res
          );
          Apiary.logger.addResourceStat(
            this.roomName,
            "labs",
            -cc,
            this.prod.res1
          );
          Apiary.logger.addResourceStat(
            this.roomName,
            "labs",
            -cc,
            this.prod.res2
          );
        }
        if (
          !labs.length &&
          !_.filter(
            this.laboratories,
            (l) =>
              l.id !== lab1.id &&
              l.id !== lab2.id &&
              l.cooldown <= this.prod!.cooldown * 2
          ).length
        )
          this.prod = undefined;
      }
    }
  }
}
