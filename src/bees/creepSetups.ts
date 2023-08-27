// body generating idea from overmind kinda
// i think i dont need custom ordered creeps
import { profile } from "../profiler/decorator";
import { setupsNames } from "../static/enums";

interface BodySetup {
  fixed?: BodyPartConstant[];
  pattern: BodyPartConstant[];
  patternLimit?: number;
}
const partScheme = {
  normal: [TOUGH, WORK, CARRY, MOVE, CLAIM, RANGED_ATTACK, ATTACK, HEAL],
  maxMove: [TOUGH, WORK, CARRY, CLAIM, RANGED_ATTACK, ATTACK, HEAL, MOVE],
};

const ROUNDING_ERROR = 0.0001;

@profile
export class CreepSetup {
  public fixed: BodyPartConstant[];
  public name: string;
  public pattern: BodyPartConstant[];
  public patternLimit: number;
  public moveMax: number | "best";
  public ignoreCarry?: boolean;
  public ignoreMove?: boolean;
  public scheme: 0 | 1 | 2;

  public constructor(
    setupName: string,
    bodySetup: BodySetup,
    moveMax: number | "best",
    scheme: CreepSetup["scheme"] = 1,
    ignoreCarry?: boolean,
    ignoreMove?: boolean
  ) {
    this.name = setupName;

    this.moveMax = moveMax;
    this.fixed = bodySetup.fixed ? bodySetup.fixed : [];
    this.pattern = bodySetup.pattern;
    this.patternLimit = bodySetup.patternLimit
      ? bodySetup.patternLimit
      : Infinity;

    this.ignoreCarry = ignoreCarry;
    this.ignoreMove = ignoreMove;
    this.scheme = scheme;
  }

  public getBody(
    energy: number,
    moveMax: number = this.moveMax === "best" ? 25 : this.moveMax
  ): { body: BodyPartConstant[]; cost: number } {
    const body: BodyPartConstant[] = [];
    const nonMoveMax = MAX_CREEP_SIZE - moveMax;
    let nonMove = 0;
    let move = 0;
    const moveAmount = (nonMoveCurrent: number) =>
      nonMoveMax > 0 ? (nonMoveCurrent * moveMax) / nonMoveMax : nonMoveCurrent;
    let bodyCost = 0;

    const addPattern = (pattern: BodyPartConstant[], maxTimes: number) => {
      const nonMovePattern = pattern.filter((s) => s !== MOVE);
      const segmentCost = _.sum(pattern, (s) => BODYPART_COST[s]);

      for (let i = 0; i < maxTimes; ++i) {
        if (body.length - move + nonMovePattern.length > nonMoveMax) return;
        const moveToAdd =
          pattern.length -
          nonMovePattern.length +
          Math.max(
            0,
            Math.ceil(
              moveAmount(nonMove + nonMovePattern.length) - ROUNDING_ERROR
            ) - move
          );
        if (body.length + moveToAdd + nonMovePattern.length > MAX_CREEP_SIZE)
          return;
        if (moveToAdd + move > moveMax && !this.ignoreMove) return;
        if (bodyCost + segmentCost + moveToAdd * BODYPART_COST[MOVE] > energy)
          return;

        _.forEach(nonMovePattern, (s) => {
          body.push(s);
          bodyCost += BODYPART_COST[s];
          if (!this.ignoreCarry || s !== CARRY) ++nonMove;
        });

        _.times(moveToAdd, () => {
          body.push(MOVE);
          bodyCost += BODYPART_COST[MOVE];
          move += 1;
        });
      }
    };

    addPattern(this.fixed, 1);
    addPattern(this.pattern, this.patternLimit);
    switch (this.scheme) {
      case 0:
        break;
      case 1: {
        body.sort(
          (a, b) => partScheme.normal.indexOf(a) - partScheme.normal.indexOf(b)
        );
        const index = body.indexOf(MOVE);
        if (index !== -1) {
          body.splice(index, 1);
          body.push(MOVE);
        }
        break;
      }
      case 2:
        body.sort(
          (a, b) =>
            partScheme.maxMove.indexOf(a) - partScheme.maxMove.indexOf(b)
        );
        break;
    }

    return {
      body,
      cost: _.sum(body, (s) => BODYPART_COST[s]),
    };
  }

  public copy() {
    return new CreepSetup(
      this.name,
      {
        pattern: this.pattern,
        fixed: this.fixed,
        patternLimit: this.patternLimit,
      },
      this.moveMax,
      this.scheme,
      this.ignoreCarry,
      this.ignoreMove
    );
  }
}

export const setups = {
  claimer: new CreepSetup(
    setupsNames.claimer,
    {
      pattern: [CLAIM],
      patternLimit: 1,
    },
    25
  ),
  downgrader: new CreepSetup(
    setupsNames.downgrader,
    {
      pattern: [CLAIM],
      patternLimit: Infinity,
    },
    25
  ),
  queen: new CreepSetup(
    setupsNames.queen,
    {
      pattern: [CARRY],
    },
    50 / 3
  ),
  manager: new CreepSetup(
    setupsNames.manager,
    {
      pattern: [CARRY],
      patternLimit: 6,
    },
    1
  ),
  hauler: new CreepSetup(
    setupsNames.hauler,
    {
      fixed: [WORK],
      pattern: [CARRY],
    },
    50 / 3
  ),
  pickup: new CreepSetup(
    setupsNames.depositHauler,
    {
      pattern: [CARRY],
    },
    "best"
  ),
  miner: {
    energy: new CreepSetup(
      setupsNames.minerEnergy,
      {
        fixed: [CARRY],
        pattern: [WORK],
        patternLimit: 6,
      },
      15,
      undefined,
      true
    ),
    minerals: new CreepSetup(
      setupsNames.minerMinerals,
      {
        pattern: [WORK],
      },
      50 / 5,
      undefined,
      true
    ),
    power: new CreepSetup(
      setupsNames.powerMinerAttacker,
      {
        pattern: [ATTACK],
        patternLimit: 20,
      },
      25
    ),
    powerhealer: new CreepSetup(
      setupsNames.powerMinerHealer,
      {
        pattern: [HEAL],
      },
      25
    ),
    deposit: new CreepSetup(
      setupsNames.depositMinerMiner,
      {
        fixed: [CARRY, CARRY],
        pattern: [WORK],
      },
      0,
      undefined,
      undefined,
      true
    ),
  },
  puller: new CreepSetup(
    setupsNames.depositMinerPuller,
    {
      pattern: [MOVE],
      patternLimit: 50,
    },
    50
  ),
  puppet: new CreepSetup(
    setupsNames.scout,
    {
      pattern: [MOVE],
      patternLimit: 1,
    },
    25
  ),
  upgrader: {
    manual: new CreepSetup(
      setupsNames.upgrader,
      {
        pattern: [WORK, CARRY],
        patternLimit: 10,
      },
      50 / 3
    ),
    fast: new CreepSetup(
      setupsNames.upgrader,
      {
        fixed: [CARRY],
        pattern: [WORK],
      },
      10,
      undefined,
      true
    ),
  },
  builder: new CreepSetup(
    setupsNames.builder,
    {
      pattern: [WORK, CARRY],
      patternLimit: 10,
    },
    10
  ),
  bootstrap: new CreepSetup(
    setupsNames.bootstrap,
    {
      pattern: [WORK, CARRY],
      patternLimit: 6,
    },
    50 / 3,
    0
  ),
  defender: {
    normal: new CreepSetup(
      setupsNames.defender,
      {
        pattern: [RANGED_ATTACK],
        patternLimit: 2,
      },
      "best",
      2
    ),
    sk: new CreepSetup(
      setupsNames.skdefender,
      {
        pattern: [
          HEAL,
          RANGED_ATTACK,
          RANGED_ATTACK,
          RANGED_ATTACK,
          RANGED_ATTACK,
        ],
      },
      25
    ),
    destroyer: new CreepSetup(
      setupsNames.destroyer,
      {
        pattern: [ATTACK],
      },
      "best",
      2
    ),
  },
  knight: new CreepSetup(
    setupsNames.knight,
    {
      fixed: [HEAL, HEAL, HEAL, HEAL, HEAL, TOUGH, TOUGH],
      pattern: [RANGED_ATTACK],
    },
    "best"
  ),
  dismantler: new CreepSetup(
    setupsNames.dismantler,
    {
      pattern: [WORK],
    },
    "best"
  ),
  healer: new CreepSetup(
    setupsNames.healer,
    {
      pattern: [HEAL],
    },
    "best"
  ),
};
