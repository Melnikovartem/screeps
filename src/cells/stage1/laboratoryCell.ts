import { Cell } from "../_Cell";
import type { Bee } from "../../bee";
import type { Hive } from "../../Hive";

import { profile } from "../../profiler/decorator";

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
console.log(ss);
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
console.log(`{${ss}}`);
console.log(JSON.stringify(s));
*/



type BaseMineral = "H" | "O" | "Z" | "L" | "K" | "U" | "X";
export type ReactionConstant = "G" | "OH" | "ZK" | "UL" | "LH" | "ZH" | "GH" | "KH" | "UH" | "LO" | "ZO" | "KO" | "UO" | "GO" | "LH2O" | "KH2O" | "ZH2O" | "UH2O" | "GH2O" | "LHO2" | "UHO2" | "KHO2" | "ZHO2" | "GHO2" | "XUH2O" | "XUHO2" | "XKH2O" | "XKHO2" | "XLH2O" | "XLHO2" | "XZH2O" | "XZHO2" | "XGH2O" | "XGHO2";
type BoostType = "harvest" | "build" | "dismantle" | "upgrade" | "attack" | "rangedAttack" | "heal" | "capacity" | "fatigue" | "damage";

const BOOST_MINERAL: { [key in BoostType]: [ReactionConstant, ReactionConstant, ReactionConstant] } = { "harvest": ["XUHO2", "UHO2", "UO"], "build": ["XLH2O", "LH2O", "LH"], "dismantle": ["XZH2O", "ZH2O", "ZH"], "upgrade": ["XGH2O", "GH2O", "GH"], "attack": ["XUH2O", "UH2O", "UH"], "rangedAttack": ["XKHO2", "KHO2", "KO"], "heal": ["XLHO2", "LHO2", "LO"], "capacity": ["XKH2O", "KH2O", "KH"], "fatigue": ["XZHO2", "ZHO2", "ZO"], "damage": ["XGHO2", "GHO2", "GO"] };
const BOOST_PARTS: { [key in BoostType]: BodyPartConstant } = { "harvest": WORK, "build": WORK, "dismantle": WORK, "upgrade": WORK, "attack": ATTACK, "rangedAttack": RANGED_ATTACK, "heal": HEAL, "capacity": CARRY, "fatigue": MOVE, "damage": TOUGH };

const BOOST_LVL: 0 | 1 | 2 = 0; // the lower number the better quality of boosts is allowed

const REACTION_MAP: { [key in ReactionConstant | BaseMineral]?: { res1: ReactionConstant | BaseMineral, res2: ReactionConstant | BaseMineral } } = {};
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

@profile
export class laboratoryCell extends Cell {
  laboratories: { [id: string]: StructureLab } = {};
  // inLab check for delivery system
  boostLabs: { [key in ResourceConstant]?: string } = {};
  boostRequests: { [id: string]: { type: BoostType, res?: ReactionConstant, amount?: number }[] } = {};
  labsStates: { [id: string]: "idle" | "production" | "source" | ReactionConstant } = {}
  synthesizeRequests: SynthesizeRequest[] = [];
  currentRequest?: SynthesizeRequest;
  sourceLabs: [string, string] | undefined;

  constructor(hive: Hive) {
    super(hive, "LaboratoryCell_" + hive.room.name);
  }

  updateProductionLabs() {
    if (this.currentRequest && this.sourceLabs) {
      let ans: StructureLab[] = [];
      _.forEach(this.laboratories, (l) => {
        if (this.labsStates[l.id] === "idle" && (!l.mineralType || l.mineralType === this.currentRequest!.res)
          && l.pos.getRangeTo(this.laboratories[this.sourceLabs![0]]) <= 2
          && l.pos.getRangeTo(this.laboratories[this.sourceLabs![1]]) <= 2) {
          this.labsStates[l.id] = "production";
          let storageCell = this.hive.cells.storage;
          if (storageCell)
            delete storageCell.requests["lab_" + l.id];
          ans.push(l);
        }
      });
    }
  }

  newSynthesizeRequest(resource: ReactionConstant, amount?: number, coef?: number): number {
    if (!Object.keys(REACTION_TIME).includes(resource))
      return 0;
    if (!amount) {
      amount = 0;
      let mainStore = this.hive.cells.storage && this.hive.cells.storage.storage.store;
      if (mainStore) {
        let res1 = REACTION_MAP[resource]!.res1;
        let res2 = REACTION_MAP[resource]!.res2;
        let res1Amount = mainStore.getUsedCapacity(res1) + _.sum(this.laboratories, (lab) => lab.store.getUsedCapacity(res1));
        let res2Amount = mainStore.getUsedCapacity(res2) + _.sum(this.laboratories, (lab) => lab.store.getUsedCapacity(res2));
        amount = Math.min(res1Amount, res2Amount);
      }
    }
    amount -= amount % 5;
    if (coef)
      amount *= coef;
    if (amount > 0)
      this.synthesizeRequests.push({
        plan: amount,
        res: resource,
        res1: REACTION_MAP[resource]!.res1,
        res2: REACTION_MAP[resource]!.res2,
        cooldown: REACTION_TIME[resource],
      });
    return amount;
  }

  askForBoost(bee: Bee, requests: { type: BoostType, amount?: number }[]) {
    let storageCell = this.hive.cells.storage;
    if (Game.time - bee.memory.born <= 600 && storageCell && storageCell!.master.manager) {
      if (!this.boostRequests[bee.ref] || Game.time % 25 === 0) {
        this.boostRequests[bee.ref] = requests;
        for (let k = 0; k < this.boostRequests[bee.ref].length; ++k) {
          let r = this.boostRequests[bee.ref][k];
          if (!r.amount)
            r.amount = bee.getBodyParts(BOOST_PARTS[r.type], -1);
          _.some(BOOST_MINERAL[r.type], (resIter, k) => {
            if (this.boostLabs[resIter]) {
              r.res = resIter;
              return true;
            }
            let sum = storageCell!.storage.store.getUsedCapacity(resIter)
              + storageCell!.master.manager!.store.getUsedCapacity(resIter)
              + Math.max(..._.map(this.laboratories, (l) => "idle" === this.labsStates[l.id] ? l.store.getUsedCapacity(resIter) : 0));
            if (sum > LAB_BOOST_MINERAL) {
              r.res = resIter;
              r.amount = Math.min(r.amount!, Math.floor(sum / LAB_BOOST_MINERAL));
            }
            if (BOOST_LVL - k < 0)
              return true;
            return r.res;
          });
        }
      }
      for (let k = 0; k < this.boostRequests[bee.ref].length; ++k) {
        let r = this.boostRequests[bee.ref][k];
        let lab: StructureLab | undefined;

        if (!r.res || !r.amount)
          continue;
        r.amount = Math.min(r.amount, bee.getBodyParts(BOOST_PARTS[r.type], -1));
        if (!r.amount)
          continue;

        if (this.boostLabs[r.res])
          lab = this.laboratories[this.boostLabs[r.res]!];
        else {
          _.some(this.laboratories, (l) => {
            if (this.labsStates[l.id] === "idle" && l.mineralType === r.res)
              lab = l;
            return lab;
          });
          if (!lab)
            _.some(this.laboratories, (l) => {
              if (this.labsStates[l.id] === "idle")
                lab = l;
              return lab;
            });
          if (!lab)
            _.some(this.laboratories, (l) => {
              if (this.labsStates[l.id] === "production" && l.mineralType === r.res)
                lab = l;
              return lab;
            });
          if (!lab)
            _.some(this.laboratories, (l) => {
              if (this.labsStates[l.id] === "production")
                lab = l;
              return lab;
            });
          if (lab) {
            this.boostLabs[r.res!] = lab.id;
            this.labsStates[lab.id] = r.res!;
            delete storageCell.requests["lab_" + lab.id];
          }
        }

        if (!lab)
          continue;

        if (lab.store.getUsedCapacity(r.res) >= LAB_BOOST_MINERAL && lab.store.getUsedCapacity(RESOURCE_ENERGY) >= LAB_BOOST_ENERGY) {
          if (lab.store.getUsedCapacity(r.res) >= r.amount * LAB_BOOST_MINERAL
            && lab.store.getUsedCapacity(RESOURCE_ENERGY) >= r.amount * LAB_BOOST_ENERGY) {
            let pos = lab.pos.getOpenPositions(true)[0];
            if (bee.pos.x === pos.x, bee.pos.y === pos.y) {
              let ans = lab.boostCreep(bee.creep, r.amount);
              if (ans === OK) {
                // bad things if 2 creeps want to be boosted at same time
                r.amount = 0;
                if (Apiary.logger) {
                  Apiary.logger.addResourceStat(this.hive.roomName, "boosts", r.amount * LAB_BOOST_MINERAL, r.res);
                  Apiary.logger.addResourceStat(this.hive.roomName, "boosts", r.amount * LAB_BOOST_ENERGY, RESOURCE_ENERGY);
                }
              }
            } else {
              bee.goRest(pos);
              return ERR_NOT_IN_RANGE;
            }
          }
        } else
          bee.goRest(this.pos);
        return ERR_TIRED;
      }
    }
    delete this.boostRequests[bee.ref];
    return OK;
  }

  update() {
    super.update(["laboratories"]);
    let storageCell = this.hive.cells.storage;
    if (storageCell && Object.keys(this.laboratories).length) {
      _.forEach(this.laboratories, (l) => {
        let state = this.labsStates[l.id];
        let res: MineralConstant | ReactionConstant | null;
        switch (state) {
          case undefined:
            this.labsStates[l.id] = "idle";
          case "idle":
            res = l.mineralType;
            if (res)
              storageCell!.requestToStorage("lab_" + l.id, l, 4, res);
            break;
          case "source":
            break;
          case "production":
            res = l.mineralType;
            if (res && !storageCell!.requests[l.id] && (!this.currentRequest || res !== this.currentRequest.res
              || l.store.getUsedCapacity(res) >= LAB_MINERAL_CAPACITY / 2))
              storageCell!.requestToStorage("lab_" + l.id, l, 3, res);
            break;
          default: // boosting lab
            // producing and dont need the boost TODO
            res = state;
            if (l.mineralType && l.mineralType !== res)
              storageCell!.requestToStorage("lab_" + l.id, l, 1, l.mineralType);
            if (!storageCell!.requests[l.id] && l.store.getUsedCapacity(res) < LAB_MINERAL_CAPACITY / 2)
              storageCell!.requestFromStorage("lab_" + l.id, l, 1, res);
            break;
        }
      });

      if (this.currentRequest && this.sourceLabs) {
        let lab1 = this.laboratories[this.sourceLabs[0]];
        let lab2 = this.laboratories[this.sourceLabs[1]];

        let updateSourceLab = (l: StructureLab, r: BaseMineral | ReactionConstant) => {
          let freeCap = l.store.getFreeCapacity(r);
          if ((freeCap > LAB_MINERAL_CAPACITY / 2 || this.currentRequest!.plan <= LAB_MINERAL_CAPACITY)
            && l.store.getUsedCapacity(r) < this.currentRequest!.plan)
            storageCell!.requestFromStorage("lab_" + l.id, l, 3, r,
              Math.min(LAB_MINERAL_CAPACITY, Math.max(LAB_MINERAL_CAPACITY - this.currentRequest!.plan, this.currentRequest!.plan)));
        };

        updateSourceLab(lab1, this.currentRequest.res1);
        updateSourceLab(lab2, this.currentRequest.res2);

        if (this.currentRequest.plan < 5) {
          this.labsStates[lab1.id] = "idle";
          this.labsStates[lab2.id] = "idle";
          this.currentRequest = undefined;
          this.sourceLabs = undefined;
          _.forEach(this.laboratories, (l) => {
            if (this.labsStates[l.id] === "production")
              this.labsStates[l.id] = "idle";
          });
        }
      } else {
        if (!this.currentRequest)
          this.currentRequest = this.synthesizeRequests.shift();

        if (!this.sourceLabs && this.currentRequest) {
          let res1 = this.currentRequest.res1;
          let res2 = this.currentRequest.res2;

          let potentialMineral = (l: StructureLab, r: BaseMineral | ReactionConstant) => l.store.getFreeCapacity(r) + l.store.getUsedCapacity(r);

          let lab1 = _.filter(this.laboratories, (l) => this.labsStates[l.id] === "idle" && potentialMineral(l, res1) >= 5)
            .reduce((prev, curr) => curr.store.getUsedCapacity(res1) > prev.store.getUsedCapacity(res1) ? curr : prev);
          let lab2;
          if (lab1)
            lab2 = _.filter(this.laboratories, (l) => this.labsStates[l.id] === "idle" && potentialMineral(l, res2) >= 5
              && l.id !== lab1.id).reduce((prev, curr) => curr.store.getUsedCapacity(res2) > prev.store.getUsedCapacity(res2) ? curr : prev);

          if (lab1 && lab2) {
            this.labsStates[lab1.id] = "source";
            this.labsStates[lab2.id] = "source";
            delete storageCell.requests["lab_" + lab1.id];
            delete storageCell.requests["lab_" + lab2.id];
            this.sourceLabs = [lab1.id, lab2.id];
            this.updateProductionLabs();
          }
        }

        _.forEach(this.laboratories, (lab) => {
          if (lab.store.getFreeCapacity(RESOURCE_ENERGY) > LAB_ENERGY_CAPACITY / 4)
            storageCell!.requestFromStorage("lab_" + lab.id, lab, lab.store.getFreeCapacity(RESOURCE_ENERGY) > LAB_ENERGY_CAPACITY / 2 ? 2 : 5);
        });
      }
    }
  }

  run() {
    if (this.currentRequest && Game.time % this.currentRequest.cooldown === 0 && this.currentRequest.plan >= 5) {
      if (this.sourceLabs) {
        let lab1 = this.laboratories[this.sourceLabs[0]];
        let lab2 = this.laboratories[this.sourceLabs[1]];
        if (lab1.store[this.currentRequest.res1] >= 5 && lab2.store[this.currentRequest.res2] >= 5) {
          this.updateProductionLabs();
          let labs = _.filter(this.laboratories, (lab) => !lab.cooldown &&
            this.labsStates[lab.id] === "production" && lab.store.getFreeCapacity(this.currentRequest!.res) >= 5);
          for (const k in labs)
            if (labs[k].runReaction(lab1, lab2) === OK) {
              if (Apiary.logger)
                Apiary.logger.addResourceStat(this.hive.roomName, "labs", -5, this.currentRequest.res);
              this.currentRequest.plan -= 5;
            }
        }
      }
    }

    // here some boost logic
  }
}
