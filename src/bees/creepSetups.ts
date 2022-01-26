// body generating idea from overmind kinda
// i think i dont need custom ordered creeps
import { setupsNames } from "../enums";
import { profile } from "../profiler/decorator";

interface BodySetup {
  fixed?: BodyPartConstant[];
  pattern: BodyPartConstant[];
  patternLimit?: number;
}
const partScheme = {
  normal: [TOUGH, WORK, CARRY, MOVE, CLAIM, RANGED_ATTACK, ATTACK, HEAL],
  maxMove: [TOUGH, WORK, CARRY, CLAIM, RANGED_ATTACK, ATTACK, HEAL, MOVE]
}

const ROUNDING_ERROR = 0.0001;

@profile
export class CreepSetup {
  name: string;
  fixed: BodyPartConstant[];
  pattern: BodyPartConstant[];
  patternLimit: number;
  moveMax: number | "best";
  ignoreCarry?: boolean;
  ignoreMove?: boolean;
  scheme: 0 | 1 | 2;

  constructor(setupName: string, bodySetup: BodySetup, moveMax: number | "best"
    , scheme: CreepSetup["scheme"] = 1, ignoreCarry?: boolean, ignoreMove?: boolean) {
    this.name = setupName;

    this.moveMax = moveMax;
    this.fixed = bodySetup.fixed ? bodySetup.fixed : [];
    this.pattern = bodySetup.pattern;
    this.patternLimit = bodySetup.patternLimit ? bodySetup.patternLimit : Infinity;

    this.ignoreCarry = ignoreCarry;
    this.ignoreMove = ignoreMove;
    this.scheme = scheme;
  }

  getBody(energy: number, moveMax: number = this.moveMax === "best" ? 25 : this.moveMax): { body: BodyPartConstant[], cost: number } {
    let body: BodyPartConstant[] = [];
    let nonMoveMax = MAX_CREEP_SIZE - moveMax;
    let nonMove = 0;
    let move = 0;
    let moveAmount = (nonMoveCurrent: number) => nonMoveMax > 0 ? nonMoveCurrent * moveMax / nonMoveMax : nonMoveCurrent;
    let bodyCost = 0;

    let addPattern = (pattern: BodyPartConstant[], maxTimes: number) => {
      let nonMovePattern = pattern.filter(s => s !== MOVE);
      let segmentCost = _.sum(pattern, s => BODYPART_COST[s]);

      for (let i = 0; i < maxTimes; ++i) {
        if ((body.length - move) + nonMovePattern.length > nonMoveMax)
          return;
        let moveToAdd = pattern.length - nonMovePattern.length
          + Math.max(0, Math.ceil(moveAmount(nonMove + nonMovePattern.length) - ROUNDING_ERROR) - move);
        if (body.length + moveToAdd + nonMovePattern.length > MAX_CREEP_SIZE)
          return;
        if (moveToAdd + move > moveMax && !this.ignoreMove)
          return;
        if (bodyCost + segmentCost + moveToAdd * BODYPART_COST[MOVE] > energy)
          return;

        _.forEach(nonMovePattern, s => {
          body.push(s);
          bodyCost += BODYPART_COST[s];
          if (!this.ignoreCarry || s !== CARRY)
            ++nonMove;
        });

        _.times(moveToAdd, _ => {
          body.push(MOVE);
          bodyCost += BODYPART_COST[MOVE];
          move += 1;
        });
      }
    }

    addPattern(this.fixed, 1);
    addPattern(this.pattern, this.patternLimit);
    switch (this.scheme) {
      case 0:
        break;
      case 1:
        body.sort((a, b) => partScheme.normal.indexOf(a) - partScheme.normal.indexOf(b));
        let index = body.indexOf(MOVE);
        if (index !== -1) {
          body.splice(index, 1);
          body.push(MOVE);
        }
        break;
      case 2:
        body.sort((a, b) => partScheme.maxMove.indexOf(a) - partScheme.maxMove.indexOf(b));
        break;
    }

    return {
      body: body,
      cost: _.sum(body, s => BODYPART_COST[s]),
    };
  }

  copy() {
    return new CreepSetup(this.name
      , { pattern: this.pattern, fixed: this.fixed, patternLimit: this.patternLimit }
      , this.moveMax, this.scheme, this.ignoreCarry, this.ignoreMove);
  }
}


export const setups = {
  claimer: new CreepSetup(setupsNames.claimer, {
    pattern: [CLAIM],
    patternLimit: 1,
  }, 25),
  downgrader: new CreepSetup(setupsNames.claimer + " D", {
    pattern: [CLAIM],
    patternLimit: Infinity,
  }, 25),
  queen: new CreepSetup(setupsNames.queen, {
    pattern: [CARRY],
  }, 50 / 3),
  hauler: new CreepSetup(setupsNames.hauler, {
    fixed: [WORK],
    pattern: [CARRY],
  }, 50 / 3),
  pickup: new CreepSetup(setupsNames.hauler + " P", {
    pattern: [CARRY],
  }, "best"),
  miner: {
    energy: new CreepSetup(setupsNames.miner, {
      fixed: [CARRY],
      pattern: [WORK],
      patternLimit: 6,
    }, 15, undefined, true),
    minerals: new CreepSetup(setupsNames.miner + " M", {
      pattern: [WORK],
    }, 50 / 5, undefined, true),
    power: new CreepSetup(setupsNames.miner + " P", {
      pattern: [ATTACK],
      patternLimit: 20,
    }, 25),
    powerhealer: new CreepSetup(setupsNames.healer + " P", {
      pattern: [HEAL],
    }, 25),
    deposit: new CreepSetup(setupsNames.miner + " D", {
      fixed: [CARRY, CARRY],
      pattern: [WORK],
    }, 0, undefined, undefined, true),
  },
  upgrader: {
    manual: new CreepSetup(setupsNames.upgrader, {
      pattern: [WORK, CARRY],
      patternLimit: 10,
    }, 50 / 3),
    fast: new CreepSetup(setupsNames.upgrader, {
      fixed: [CARRY],
      pattern: [WORK],
    }, 10, undefined, true),
  },
  builder: new CreepSetup(setupsNames.builder, {
    pattern: [WORK, WORK, CARRY],
    patternLimit: 10,
  }, 20),
  bootstrap: new CreepSetup(setupsNames.bootstrap, {
    pattern: [WORK, CARRY],
    patternLimit: 6,
  }, 50 / 3, 0),
  puppet: new CreepSetup(setupsNames.scout, {
    pattern: [MOVE],
    patternLimit: 1,
  }, 25),
  puller: new CreepSetup(setupsNames.scout + " P", {
    pattern: [MOVE],
    patternLimit: 50,
  }, 50),
  defender: {
    normal: new CreepSetup(setupsNames.defender, {
      pattern: [RANGED_ATTACK],
      patternLimit: 2,
    }, "best", 2),
    sk: new CreepSetup(setupsNames.skdefender, {
      pattern: [HEAL, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK],
    }, 25),
    destroyer: new CreepSetup(setupsNames.defender + " DD", {
      pattern: [ATTACK],
    }, "best", 2),
  },
  knight: new CreepSetup(setupsNames.knight, {
    fixed: [HEAL, HEAL, HEAL, HEAL, HEAL],
    pattern: [RANGED_ATTACK],
  }, "best"),
  dismantler: new CreepSetup(setupsNames.dismantler, {
    pattern: [WORK],
  }, "best"),
  healer: new CreepSetup(setupsNames.healer, {
    pattern: [HEAL],
  }, "best"),
}

/*
let printSetup = (s: CreepSetup, energy = Infinity, moveMax?: number) => {
  let setup = s.getBody(energy, moveMax);
  let nonMoveLen = setup.body.filter(s => s != MOVE).length;
  console .log(`${s.name}: ${nonMoveLen}/${setup.body.length} aka ${Math.round(nonMoveLen / setup.body.length * 1000) / 10}% cost: ${setup.cost}/${energy}`);
  return setup.body;
}


printSetup(setups.defender.sk)

/*
printSetup(new CreepSetup("test bee", {
  pattern: [MOVE],
}, 50), 10000)


printSetup(setups.defender.destroyer, 650)
printSetup(setups.hauler, 3000)
printSetup(setups.defender.destroyer, 650)
printSetup(setups.bootstrap, 600)
printSetup(setups.queen)
printSetup(setups.claimer)
printSetup(setups.manager)
printSetup(setups.queen, 1000)
printSetup(setups.pickup)
printSetup(setups.miner.energy)
printSetup(setups.miner.minerals)
printSetup(setups.miner.power)
printSetup(setups.upgrader.fast)
printSetup(setups.upgrader.manual)
printSetup(setups.builder, 1300)
printSetup(setups.puppet)
printSetup(setups.defender.normal)
printSetup(setups.defender.sk)
printSetup(setups.knight, 975)
printSetup(setups.dismantler)
printSetup(setups.healer, 1300)
printSetup(setups.archer, undefined, 10);
printSetup(setups.healer, undefined, 10);
printSetup(setups.knight, undefined, 17);
*/
