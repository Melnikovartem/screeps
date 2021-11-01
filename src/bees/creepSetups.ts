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
  normal: [TOUGH, WORK, CARRY, CLAIM, MOVE, RANGED_ATTACK, ATTACK, HEAL],
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
  scheme: 0 | 1;

  constructor(setupName: string, bodySetup: BodySetup, moveMax: number | "best", ignoreCarry?: boolean, scheme: 0 | 1 = 0) {
    this.name = setupName;

    this.moveMax = moveMax;
    this.ignoreCarry = ignoreCarry;
    this.fixed = bodySetup.fixed ? bodySetup.fixed : [];
    this.pattern = bodySetup.pattern;
    this.patternLimit = bodySetup.patternLimit ? bodySetup.patternLimit : Infinity;
    this.scheme = scheme;
  }

  getBody(energy: number, moveMax: number = this.moveMax === "best" ? 25 : this.moveMax): { body: BodyPartConstant[], cost: number } {
    let body: BodyPartConstant[] = [];
    let nonMoveMax = MAX_CREEP_SIZE - moveMax;
    let nonMove = 0;
    let moveAmount = (nonMoveCurrent: number) => nonMoveMax > 0 ? nonMoveCurrent * moveMax / nonMoveMax : nonMoveCurrent;
    let bodyCost = 0;

    let addPattern = (pattern: BodyPartConstant[], maxTimes: number) => {
      let nonMovePattern = pattern.filter(s => s !== MOVE);
      let segmentCost = _.sum(pattern, s => BODYPART_COST[s]);

      for (let i = 0; i < maxTimes; ++i) {
        if (nonMove + nonMovePattern.length > nonMoveMax)
          return;
        let moveToAdd = pattern.length - nonMovePattern.length
          + Math.max(0, Math.ceil(moveAmount(nonMove + nonMovePattern.length) - ROUNDING_ERROR) - (body.length - nonMove));
        if (body.length + moveToAdd + nonMovePattern.length > MAX_CREEP_SIZE)
          return;
        if (moveToAdd + (body.length - nonMove) > moveMax)
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
        });
      }
    }

    addPattern(this.fixed, 1);
    addPattern(this.pattern, this.patternLimit);
    switch (this.scheme) {
      case 0:
        body.sort((a, b) => partScheme.normal.indexOf(a) - partScheme.normal.indexOf(b));
        let index = body.indexOf(MOVE);
        if (index !== -1) {
          body.splice(index, 1);
          body.push(MOVE);
        }
        break;
      case 1:
        body.sort((a, b) => partScheme.maxMove.indexOf(a) - partScheme.maxMove.indexOf(b));
        break;
    }

    return {
      body: body,
      cost: _.sum(body, s => BODYPART_COST[s]),
    };
  }

  copy() {
    return new CreepSetup(this.name, { pattern: this.pattern, fixed: this.fixed, patternLimit: this.patternLimit }, this.moveMax, this.ignoreCarry);
  }
}


export const setups = {
  claimer: new CreepSetup(setupsNames.claimer, {
    pattern: [CLAIM],
    patternLimit: 1,
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
    patternLimit: 16,
  }, "best"),
  miner: {
    energy: new CreepSetup(setupsNames.miner, {
      fixed: [CARRY],
      pattern: [WORK],
      patternLimit: 6,
    }, 20, true),
    minerals: new CreepSetup(setupsNames.miner + " M", {
      pattern: [WORK],
    }, 50 / 5, true),
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
    }, 10, true),
  },
  builder: new CreepSetup(setupsNames.builder, {
    pattern: [WORK, WORK, CARRY],
    patternLimit: 10,
  }, 20),
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
      pattern: [RANGED_ATTACK],
      patternLimit: 2,
    }, 25),
    sk: new CreepSetup(setupsNames.defender + " SK", {
      fixed: [HEAL, HEAL, HEAL],
      pattern: [RANGED_ATTACK],
    }, 25),
    destroyer: new CreepSetup(setupsNames.defender + " DD", {
      pattern: [ATTACK],
    }, "best", undefined, 1),
  },
  knight: new CreepSetup(setupsNames.knight, {
    fixed: [TOUGH, TOUGH, TOUGH, HEAL, HEAL, HEAL, HEAL, HEAL],
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
  console.log(`${s.name}: ${nonMoveLen}/${setup.body.length} aka ${Math.round(nonMoveLen / setup.body.length * 1000) / 10}% cost: ${setup.cost}/${energy}`);
  return setup.body;
}


printSetup(setups.miner.energy)

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
printSetup(setups.archer, Game.rooms["E12N48"].energyCapacityAvailable, 10);
printSetup(setups.healer, Game.rooms["E12N48"].energyCapacityAvailable, 10);
printSetup(setups.knight, Game.rooms["E12N48"].energyCapacityAvailable, 17);
*/
