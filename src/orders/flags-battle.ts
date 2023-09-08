import { prefix } from "static/enums";

import type { FlagCommand } from "./flagCommands";
import { SWARM_MASTER } from "./swarmOrder-masters";

export function actBattle(command: FlagCommand) {
  switch (command.secondaryColor) {
    case COLOR_BLUE:
      command.createSwarm(SWARM_MASTER.hordedefense);
      break;
    case COLOR_RED: {
      command.createSwarm(SWARM_MASTER.horde);
      break;
    }
    case COLOR_PURPLE:
      command.createSwarm(SWARM_MASTER.downgrader);
      break;
    case COLOR_WHITE:
      command.fixedName(prefix.surrender + command.hiveName);
      if (Game.time < command.createTime + CREEP_LIFE_TIME)
        command.acted = false;
      break;
  }
}
