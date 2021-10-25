import { Cell } from "../_Cell";

import { prefix, hiveStates } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Bee } from "../../bees/bee";
import type { Hive } from "../../Hive";
import type { StorageCell } from "./storageCell";

type BaseMineral = "H" | "O" | "Z" | "L" | "K" | "U" | "X";
export type ReactionConstant = "G" | "OH" | "ZK" | "UL" | "LH" | "ZH" | "GH" | "KH" | "UH" | "LO" | "ZO" | "KO" | "UO" | "GO" | "LH2O" | "KH2O" | "ZH2O" | "UH2O" | "GH2O" | "LHO2" | "UHO2" | "KHO2" | "ZHO2" | "GHO2" | "XUH2O" | "XUHO2" | "XKH2O" | "XKHO2" | "XLH2O" | "XLHO2" | "XZH2O" | "XZHO2" | "XGH2O" | "XGHO2";
type BoostType = "harvest" | "build" | "dismantle" | "upgrade" | "attack" | "rangedAttack" | "heal" | "capacity" | "fatigue" | "damage";

export const BOOST_MINERAL: { [key in BoostType]: [ReactionConstant, ReactionConstant, ReactionConstant] } = { "harvest": ["UO", "UHO2", "XUHO2"], "build": ["LH", "LH2O", "XLH2O"], "dismantle": ["ZH", "ZH2O", "XZH2O"], "upgrade": ["GH", "GH2O", "XGH2O"], "attack": ["UH", "UH2O", "XUH2O"], "rangedAttack": ["KO", "KHO2", "XKHO2"], "heal": ["LO", "LHO2", "XLHO2"], "capacity": ["KH", "KH2O", "XKH2O"], "fatigue": ["ZO", "ZHO2", "XZHO2"], "damage": ["GO", "GHO2", "XGHO2"] };
export const BOOST_PARTS: { [key in BoostType]: BodyPartConstant } = { "harvest": WORK, "build": WORK, "dismantle": WORK, "upgrade": WORK, "attack": ATTACK, "rangedAttack": RANGED_ATTACK, "heal": HEAL, "capacity": CARRY, "fatigue": MOVE, "damage": TOUGH };

export const BASE_MINERALS: ResourceConstant[] = ["H", "K", "L", "U", "X", "O", "Z"];
export const REACTION_MAP: { [key in ReactionConstant | BaseMineral]?: { res1: ReactionConstant | BaseMineral, res2: ReactionConstant | BaseMineral } } = {};
for (const res1 in REACTIONS) {
  for (const res2 in REACTIONS[res1])
    REACTION_MAP[<ReactionConstant | BaseMineral>REACTIONS[res1][res2]] = {
      res1: <ReactionConstant | BaseMineral>res1,
      res2: <ReactionConstant | BaseMineral>res2,
    };
}

//reaction map done

interface SynthesizeRequest {
  plan: number,
  res: ReactionConstant,
  res1: ReactionConstant | BaseMineral,
  res2: ReactionConstant | BaseMineral,
  cooldown: number,
};

export type BoostRequest = { type: BoostType, amount?: number, lvl: 0 | 1 | 2 }
type BoostInfo = { type: BoostType, res: ReactionConstant, amount: number, lvl: 0 | 1 | 2 };
type LabState = "idle" | "production" | "source" | ReactionConstant;
@profile
export class LaboratoryCell extends Cell {
  laboratories: { [id: string]: StructureLab } = {};
  // inLab check for delivery system
  boostLabs: { [key in ResourceConstant]?: string } = {};
  boostRequests: { [id: string]: { info: BoostInfo[], lastUpdated: number } } = {};
  labStates: { [id: string]: LabState } = {};
  synthesizeTarget: { res: ReactionConstant, amount: number } | undefined;
  synthesizeRes: SynthesizeRequest | undefined;
  prod?: SynthesizeRequest & { lab1: string, lab2: string };
  master: undefined;
  sCell: StorageCell;
  resTarget: { [key in ResourceConstant]?: number } = {};
  patience: number = 0;

  constructor(hive: Hive, sCell: StorageCell) {
    super(hive, prefix.laboratoryCell + hive.room.name);
    this.sCell = sCell;
    this.pos = this.hive.getPos("lab");
  }

  newSynthesize(resource: ReactionConstant, amount?: number, coef?: number): number {
    if (!(resource in REACTION_TIME))
      return 0;
    if (!amount) {
      amount = 0;
      let res1Amount = this.sCell.getUsedCapacity(REACTION_MAP[resource]!.res1);
      let res2Amount = this.sCell.getUsedCapacity(REACTION_MAP[resource]!.res2);
      amount = Math.min(res1Amount, res2Amount);
    }
    amount -= amount % 5;
    if (coef)
      amount *= coef;
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

  stepToTarget() {
    this.resTarget = {};
    if (!this.synthesizeTarget || this.synthesizeTarget.amount <= 0) {
      let targets: { res: ReactionConstant, amount: number }[] = [];
      for (const r in this.hive.resState) {
        let res = <ReactionConstant>r; // atually ResourceConstant
        let toCreate = -this.hive.resState[res]!;
        if (toCreate > 0 && res in REACTION_MAP)
          targets.push({ res: res, amount: toCreate });
      }
      if (!targets.length)
        targets = [{ res: "XGH2O", amount: 2048 }];
      targets.sort((a, b) => b.amount - a.amount);
      this.synthesizeTarget = targets[0];
    }

    let [createQue, ingredients] = this.getCreateQue(this.synthesizeTarget.res);

    _.forEach(ingredients, resource => {
      this.resTarget[resource] = LAB_MINERAL_CAPACITY * 2;
    });


    let amount = createQue.length && this.newSynthesize(createQue.reduce(
      (prev, curr) => this.sCell.getUsedCapacity(curr) < this.sCell.getUsedCapacity(prev) ? curr : prev));
    if (!amount)
      this.patience = 0;
    else
      ++this.patience;

    if (this.patience > 64) {
      this.patience = 0;
      this.synthesizeTarget = undefined;
    }
  }

  getCreateQue(res: ResourceConstant): [ReactionConstant[], BaseMineral[]] {
    // prob should precal for each resource
    let ingredients: BaseMineral[] = [];
    let createQue: ReactionConstant[] = [];

    let dfs = (res: ResourceConstant) => {
      let recipe = REACTION_MAP[<ReactionConstant>res];
      if (!recipe) {
        ingredients.push(<BaseMineral>res);
        return;
      }
      createQue.push(<ReactionConstant>res);
      dfs(recipe.res1);
      dfs(recipe.res2);
    }

    dfs(res);

    createQue = createQue.filter((value, index) => createQue.indexOf(value) === index);
    createQue = createQue.filter(res => {
      let recipe = REACTION_MAP[<ReactionConstant>res]!;
      return this.sCell.getUsedCapacity(recipe.res1) >= LAB_BOOST_MINERAL * 2 && this.sCell.getUsedCapacity(recipe.res2) >= LAB_BOOST_MINERAL * 2;
    })
    return [createQue, ingredients]
  }

  newProd() {
    if (!this.synthesizeRes)
      return false;

    let res1 = this.synthesizeRes.res1;
    let res2 = this.synthesizeRes.res2;

    let maxDists: { [id: string]: number } = {}
    for (let id in this.laboratories)
      maxDists[id] = Math.max(..._.map(this.laboratories, l => this.laboratories[id].pos.getRangeTo(l)));
    let comp = (prev: StructureLab, curr: StructureLab, res: BaseMineral | ReactionConstant) => {
      let cond = maxDists[prev.id] - maxDists[curr.id];
      if (cond === 0)
        cond = curr.store.getUsedCapacity(res) - prev.store.getUsedCapacity(res);
      if (cond === 0)
        cond = prev.pos.getTimeForPath(this.sCell!) - curr.pos.getTimeForPath(this.sCell!);
      return cond > 0 ? curr : prev;
    }

    let lab1 = _.map(this.laboratories, l => l).reduce((prev, curr) => comp(prev, curr, res1));
    let lab2;
    if (lab1)
      lab2 = _.filter(this.laboratories, l => l.id !== lab1.id).reduce((prev, curr) => comp(prev, curr, res2));

    if (lab1 && lab2) {
      this.prod = { ...this.synthesizeRes, lab1: lab1.id, lab2: lab2.id };
      this.labStates[lab1.id] = "source";
      this.updateLabState(lab1, 1);
      this.labStates[lab2.id] = "source";
      this.updateLabState(lab2, 1);
      this.synthesizeRes = undefined;
    }
    return true;
  }

  getBoostInfo(r: BoostRequest, bee?: Bee): BoostInfo | void {
    let res = BOOST_MINERAL[r.type][r.lvl];
    let sum = this.sCell.getUsedCapacity(res);
    let amount = r.amount || Infinity;
    amount = Math.min(amount, Math.floor(sum / LAB_BOOST_MINERAL));
    if (bee)
      amount = Math.min(amount - bee.getBodyParts(BOOST_PARTS[r.type], 1), bee.getBodyParts(BOOST_PARTS[r.type], -1));
    if (amount <= 0)
      return;
    return { type: r.type, res: res, amount: amount, lvl: r.lvl };
  }

  // lowLvl : 0 - tier 3 , 1 - tier 2+, 2 - tier 1+
  askForBoost(bee: Bee, requests?: BoostRequest[]) {
    let rCode: ScreepsReturnCode = OK;
    if (bee.ticksToLive < 1000)
      // || bee.pos.roomName !== this.pos.roomName)
      return rCode;

    if (!requests) {
      requests = bee.master && bee.master.boosts;
      if (!requests)
        return rCode;
    }

    if (!this.boostRequests[bee.ref] || this.boostRequests[bee.ref].lastUpdated + 10 >= Game.time) {
      this.boostRequests[bee.ref] = { info: [], lastUpdated: Game.time };
      for (let k = 0; k < requests.length; ++k) {
        let r = requests[k];
        let ans = this.getBoostInfo(r, bee);
        if (ans && !this.boostRequests[bee.ref].info.filter(br => br.type === r.type).length)
          this.boostRequests[bee.ref].info.push(ans);
      }
    }

    for (let k = 0; k < this.boostRequests[bee.ref].info.length; ++k) {
      let r = this.boostRequests[bee.ref].info[k];
      let lab: StructureLab | undefined;

      if (!r.res || !r.amount)
        continue;

      if (this.boostLabs[r.res])
        lab = this.laboratories[this.boostLabs[r.res]!];
      if (!lab || this.labStates[lab.id] !== r.res) {
        let getLab = (state?: LabState, sameMineral = true) => {
          _.some(this.laboratories, l => {
            let currState = this.labStates[l.id]
            if ((!sameMineral || l.mineralType === r.res) && ((!state && currState !== "source" && !(currState in REACTION_TIME)) || currState === state))
              lab = l;
            return lab;
          });
        }
        if (this.prod)
          switch (r.res) {
            case this.prod.res1:
              lab = this.laboratories[this.prod.lab1];
              break;
            case this.prod.res2:
              lab = this.laboratories[this.prod.lab2];
              break;
            case this.prod.res:
              getLab("production", false);
              break;
          }
        if (!lab)
          getLab(); //any lab same mineral
        if (!lab)
          getLab("production", false);
        if (!lab)
          getLab("idle", false);
        if (lab) {
          this.boostLabs[r.res!] = lab.id;
          this.labStates[lab.id] = r.res;
        }
      }

      if (!lab)
        continue;

      if (bee.creep.spawning) {
        rCode = ERR_BUSY;
        continue;
      }

      if (lab.store.getUsedCapacity(r.res) >= r.amount * LAB_BOOST_MINERAL
        && lab.store.getUsedCapacity(RESOURCE_ENERGY) >= r.amount * LAB_BOOST_ENERGY) {
        let pos = lab.pos.getOpenPositions(true)[0];
        if (bee.pos.isNearTo(lab)) {
          let ans = lab.boostCreep(bee.creep, r.amount);
          if (ans === OK) {
            r.amount = 0;
            if (Apiary.logger) {
              Apiary.logger.addResourceStat(this.hive.roomName, "boosts", r.amount * LAB_BOOST_MINERAL, r.res);
              Apiary.logger.addResourceStat(this.hive.roomName, "boosts", r.amount * LAB_BOOST_ENERGY, RESOURCE_ENERGY);
            }
          }
        } else if (rCode !== ERR_NOT_IN_RANGE) {
          bee.goTo(pos);
          rCode = ERR_NOT_IN_RANGE;
        }
      } else if (this.hive.state === hiveStates.lowenergy)
        continue; // help is not coming
      if (rCode !== ERR_NOT_IN_RANGE)
        rCode = ERR_TIRED;
      continue;
    }

    // console.log(rCode, JSON.stringify(this.boostRequests[bee.ref]), _.map(this.boostRequests[bee.ref], d => `${bee.getBodyParts(BOOST_PARTS[d.type], 1)} ${d.res}`))
    if (rCode === ERR_TIRED)
      bee.goRest(this.pos);
    else if (rCode === OK)
      delete this.boostRequests[bee.ref];
    return rCode;
  }

  updateLabState(l: StructureLab, rec = 0) {
    switch (rec) {
      // max recursion = 2 just to be safe i count
      default:
        return
      case 1:
        delete this.sCell.requests[l.id]
        break;
      case 0:
        break;
    }
    let state = this.labStates[l.id];
    switch (state) {
      case undefined:
        this.labStates[l.id] = "idle";
      case "idle":
        if (this.prod) {
          if (l.id === this.prod.lab1 || l.id === this.prod.lab2) {
            this.labStates[l.id] = "source";
            this.updateLabState(l, rec + 1);
          } else if (Game.time % this.prod.cooldown === 0 && !l.cooldown &&
            l.pos.getRangeTo(this.laboratories[this.prod.lab1]) <= 2 && l.pos.getRangeTo(this.laboratories[this.prod.lab1]) <= 2) {
            this.labStates[l.id] = "production";
            this.updateLabState(l, rec + 1);
          } else if (l.mineralType)
            this.sCell.requestToStorage([l], 5, l.mineralType);
        }
        break;
      case "source":
        if (!this.prod) {
          this.labStates[l.id] = "idle";
          this.updateLabState(l, rec + 1);
          break;
        }
        let r: ReactionConstant | BaseMineral;
        if (l.id === this.prod.lab1) {
          r = this.prod.res1;
        } else if (l.id === this.prod.lab2) {
          r = this.prod.res2;
        } else {
          this.labStates[l.id] = "idle";
          this.updateLabState(l, rec + 1);
          break;
        }
        let freeCap = l.store.getFreeCapacity(r);
        if (l.mineralType && l.mineralType !== r)
          this.sCell.requestToStorage([l], 3, l.mineralType);
        else if ((freeCap > LAB_MINERAL_CAPACITY / 2 || this.prod.plan <= LAB_MINERAL_CAPACITY) && l.store.getUsedCapacity(r) < this.prod.plan)
          this.sCell.requestFromStorage([l], 3, r, Math.min(this.prod.plan, freeCap));
        break;
      case "production":
        let res = l.mineralType;
        if (!this.prod) {
          this.labStates[l.id] = "idle";
          this.updateLabState(l, rec + 1);
          break;
        } else if (res && (res !== this.prod.res || l.store.getUsedCapacity(res) >= LAB_MINERAL_CAPACITY / 2))
          this.sCell.requestToStorage([l], 4, res, l.store.getUsedCapacity(res));
        break;
      default: // boosting lab : state === resource
        let toBoostMinerals = _.sum(this.boostRequests, br => {
          let sameType = br.info.filter(r => r.res == this.labStates[l.id])
          return _.sum(sameType, r => r.amount * LAB_BOOST_MINERAL);
        });
        if (!toBoostMinerals) {
          this.labStates[l.id] = "idle";
          this.updateLabState(l, rec + 1);
          return;
        }
        if (l.mineralType && l.mineralType !== state)
          this.sCell.requestToStorage([l], 1, l.mineralType);
        else if (l.store.getUsedCapacity(state) < toBoostMinerals)
          this.sCell.requestFromStorage([l], 1, state, toBoostMinerals * 3, true);
        break;
    }
  }

  update() {
    super.update(["laboratories"]);
    if (!Object.keys(this.laboratories).length)
      return;

    for (let id in this.laboratories)
      this.updateLabState(this.laboratories[id]);

    if (!this.prod && !this.newProd()) {
      this.stepToTarget();
      this.newProd();
    }

    if (this.prod) {
      this.prod.plan = Math.min(this.prod.plan,
        this.sCell.getUsedCapacity(this.prod.res1),
        this.sCell.getUsedCapacity(this.prod.res2));
      if (this.prod.plan < 5)
        this.prod = undefined;
    }

    let priority = <2 | 5>5;
    this.sCell.requestFromStorage(_.filter(this.laboratories,
      l => {
        if (l.store.getUsedCapacity(RESOURCE_ENERGY) < LAB_ENERGY_CAPACITY / 4)
          priority = 2;
        return l.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }), priority, RESOURCE_ENERGY, LAB_ENERGY_CAPACITY, true);

    for (const ref in this.boostRequests)
      if (this.boostRequests[ref].lastUpdated + 10 > Game.time)
        delete this.boostRequests[ref];
  }

  run() {
    if (this.prod && Game.time % this.prod.cooldown === 0 && this.prod.plan >= 5) {
      let lab1 = this.laboratories[this.prod.lab1];
      let lab2 = this.laboratories[this.prod.lab2];
      let amount = Math.min(lab1.store[this.prod.res1], lab2.store[this.prod.res2])
      if (amount >= 5) {
        let labs = _.filter(this.laboratories, lab => lab.store.getFreeCapacity(this.prod!.res) >= 5 &&
          (this.labStates[lab.id] === "production" || this.labStates[lab.id] === this.prod!.res) && !lab.cooldown);
        let cc = 0;
        for (let k = 0; k < labs.length && amount >= 5; ++k) {
          let ans = labs[k].runReaction(lab1, lab2);
          if (ans === OK)
            ++cc;
        }
        if (this.synthesizeTarget && this.prod.res === this.synthesizeTarget.res)
          this.synthesizeTarget.amount -= cc * 5;
        this.prod.plan -= 5 * cc;
        amount -= 5 * cc;
        if (Apiary.logger) {
          Apiary.logger.addResourceStat(this.hive.roomName, "labs", 5 * cc, this.prod.res);
          Apiary.logger.addResourceStat(this.hive.roomName, "labs", -5 * cc, this.prod.res1);
          Apiary.logger.addResourceStat(this.hive.roomName, "labs", -5 * cc, this.prod.res2);
        }
      }
    }
  }
}


/*
// i rly don't like to type in all the reactions;
let s: string[] = []; REACTION_TIME
for (let key in REACTIONS)
  if (!s.includes(key))
    s.push(key);
for (let key in REACTION_TIME) {
  if (!s.includes(key))
    s.push(key);
}
let ss = "";
for (let key in s)
  ss += " | " + '"' + s[key] + '"';
console. log(""ss);
===========================================
let s: { [action: string]: string[] } = {};
for (let key in BOOSTS)
  for (let reaction in BOOSTS[key])
    for (let action in BOOSTS[key][reaction]) {
      if (!s[action]) {
        s[action] = [];
      }
      s[action].push(reaction);
    }

let ss = "";
for (let action in s) {
  ss += action + ", ";
  s[action].reverse();
}
console. log(`{${ss}}`);
console. log(JSON.stringify(s));
*/
