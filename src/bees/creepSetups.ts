// body generating idea from overmind kinda
// i think i dont need custom ordered creeps
import { profile } from "../profiler/decorator";

interface BodySetup {
  fixed?: BodyPartConstant[];
  pattern: BodyPartConstant[];
  patternLimit?: number;
}

const partsImportance = [TOUGH, WORK, CARRY, CLAIM, MOVE, RANGED_ATTACK, ATTACK, HEAL];
const ROUNDING_ERROR = 0.0001;

@profile
export class CreepSetup {
  name: string;
  fixed: BodyPartConstant[];
  pattern: BodyPartConstant[];
  patternLimit: number;
  moveMax: number | "best";
  ignoreCarry: boolean;

  constructor(setupName: string, bodySetup: BodySetup, moveMax: number | "best", ignoreCarry = false) {
    this.name = setupName;

    this.moveMax = moveMax;
    this.fixed = bodySetup.fixed ? bodySetup.fixed : [];
    this.pattern = bodySetup.pattern;
    this.patternLimit = bodySetup.patternLimit ? bodySetup.patternLimit : Infinity;
    this.ignoreCarry = ignoreCarry;
  }

  getBody(energy: number, moveMax: number = this.moveMax === "best" ? 25 : this.moveMax): { body: BodyPartConstant[], cost: number } {
    let body: BodyPartConstant[] = [];
    let nonMoveMax = MAX_CREEP_SIZE - moveMax;
    let nonMove = 0;
    let moveAmount = (nonMoveCurrent: number) => Math.ceil(nonMoveCurrent * moveMax / nonMoveMax - ROUNDING_ERROR)
    let addPattern = (pattern: BodyPartConstant[]) => {
      if (nonMove + pattern.length <= nonMoveMax)
        _.forEach(pattern, (s) => {

          if (body.length >= MAX_CREEP_SIZE)
            return;

          if (nonMove < nonMoveMax) {
            body.push(s);
            if (s !== MOVE && (!this.ignoreCarry || s !== CARRY))
              ++nonMove;
          }

          if (moveAmount(nonMove) > body.length - nonMove && body.length < MAX_CREEP_SIZE)
            body.push(MOVE);
        });
    };

    let fixedCosts = _.sum(this.fixed, s => BODYPART_COST[s]) + moveAmount(this.fixed.length) * BODYPART_COST[MOVE];
    if (fixedCosts <= energy)
      addPattern(this.fixed);
    else
      fixedCosts = 0;

    let segmentCost = _.sum(this.pattern, s => BODYPART_COST[s]) + moveAmount(this.pattern.length) * BODYPART_COST[MOVE];
    let maxSegment = Math.min(this.patternLimit, Math.floor(nonMoveMax - nonMove + ROUNDING_ERROR) / this.pattern.length, Math.floor((energy - fixedCosts) / segmentCost));
    _.times(maxSegment, () => {
      addPattern(this.pattern);
    });

    body.sort((a, b) => partsImportance.indexOf(a) - partsImportance.indexOf(b));
    let index = body.indexOf(MOVE);
    if (index !== -1) {
      body.splice(index, 1);
      body.push(MOVE);
    }

    return {
      body: body,
      cost: _.sum(body, s => BODYPART_COST[s]),
    };
  }
}

export const setupsNames = {
  // Civilian
  claimer: 'Bee drone',
  manager: 'Stingless bee',
  hauler: 'Bumblebee',
  miner: 'Andrena',
  upgrader: 'Honey bee',
  builder: 'Colletidae',
  scout: 'Stenotritidae',
  bootstrap: 'Bee larva',
  queen: 'Bee queen',
  // War
  knight: 'European hornet',
  tank: "Red paper wasp",
  dismantler: 'Dolichovespula arenaria',
  healer: 'Bald-faced hornet',
  defender: 'Vespa affinis',
}


export const setups = {
  claimer: new CreepSetup(setupsNames.claimer, {
    pattern: [CLAIM],
    patternLimit: 1,
  }, 25),
  queen: new CreepSetup(setupsNames.queen, {
    pattern: [CARRY],
  }, 50 / 3),
  manager: new CreepSetup(setupsNames.manager, {
    pattern: [CARRY],
    patternLimit: 14,
  }, 50 / 3),
  hauler: new CreepSetup(setupsNames.hauler, {
    fixed: [WORK],
    pattern: [CARRY],
  }, 50 / 3),
  pickup: new CreepSetup(setupsNames.hauler + " P", {
    pattern: [CARRY],
    patternLimit: 16,
  }, 50 / 3),
  miner: {
    energy: new CreepSetup(setupsNames.miner, {
      fixed: [CARRY],
      pattern: [WORK],
      patternLimit: 6,
    }, 15),
    minerals: new CreepSetup(setupsNames.miner + " M", {
      fixed: [CARRY],
      pattern: [WORK],
    }, 10),
    power: new CreepSetup(setupsNames.miner + " P", {
      pattern: [ATTACK],
      patternLimit: 20,
    }, 25)
  },
  upgrader: {
    manual: new CreepSetup(setupsNames.upgrader, {
      pattern: [WORK, CARRY],
      patternLimit: 10,
    }, 50 / 3),
    fast: new CreepSetup(setupsNames.upgrader, {
      fixed: [CARRY],
      pattern: [WORK],
    }, 10),
  },
  builder: new CreepSetup(setupsNames.builder, {
    pattern: [WORK, CARRY],
    patternLimit: 10, // not sure if you need anyone bigger than that
  }, 50 / 3),
  bootstrap: new CreepSetup(setupsNames.bootstrap, {
    pattern: [WORK, CARRY],
    patternLimit: 6,
  }, 50 / 3),
  puppet: new CreepSetup(setupsNames.scout, {
    pattern: [MOVE],
    patternLimit: 1,
  }, 25),
  defender: {
    normal: new CreepSetup(setupsNames.defender, {
      fixed: [HEAL, RANGED_ATTACK],
      pattern: [RANGED_ATTACK],
      patternLimit: 3,
    }, 25),
    destroyer: new CreepSetup(setupsNames.defender, {
      pattern: [ATTACK],
      patternLimit: 10,
    }, 25),
    sk: new CreepSetup(setupsNames.defender + " SK", {
      fixed: [RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK],
      pattern: [RANGED_ATTACK, HEAL],
      patternLimit: 9,
    }, 25),
  },
  knight: new CreepSetup(setupsNames.knight, {
    fixed: [TOUGH],
    pattern: [RANGED_ATTACK, RANGED_ATTACK, HEAL],
  }, "best"),
  dismantler: new CreepSetup(setupsNames.dismantler, {
    pattern: [WORK, TOUGH],
  }, 50 / 3),
  healer: new CreepSetup(setupsNames.healer, {
    pattern: [HEAL],
  }, "best"),
}


/*
let printSetup = (s: CreepSetup, energy = Infinity) => {
  let bbody = s.getBody(energy).body;
  console .log(s.name, ":", bbody.length, bbody.filter((s) => s != MOVE).length)
  return bbody;
}

/*
printSetup(setups.defender.destroyer, 650)
printSetup(setups.bootstrap, 600)
printSetup(setups.queen)
printSetup(setups.claimer)
printSetup(setups.manager)
printSetup(setups.hauler)
printSetup(setups.pickup)
printSetup(setups.miner.energy)
printSetup(setups.miner.minerals)
printSetup(setups.miner.power)
printSetup(setups.upgrader.fast)
printSetup(setups.upgrader.manual)
printSetup(setups.builder)
printSetup(setups.puppet)
printSetup(setups.defender.normal)
printSetup(setups.defender.sk)
printSetup(setups.knight)
printSetup(setups.dismantler)
printSetup(setups.healer)
*/
