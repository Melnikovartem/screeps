import { hiveStates, prefix } from "static/enums";

import type { FlagCommand } from "./flagCommands";
import { SWARM_MASTER } from "./swarm-nums";

export function actAnnex(cm: FlagCommand) {
  switch (cm.secondaryColor) {
    case COLOR_PURPLE:
      cm.hive.cells.annex.addAnnex(cm.pos.roomName);
      break;
    case COLOR_GREY:
      if (Object.keys(Apiary.hives).length < Game.gcl.level) {
        cm.createSwarm(SWARM_MASTER.claimer);
      } else cm.acted = false;
      break;
    case COLOR_RED:
      _.forEach(Apiary.hives, (h) =>
        h.cells.annex.removeAnnex(cm.pos.roomName)
      );
      break;
    case COLOR_WHITE: {
      cm.acted = false;
      const hiveToBoos = Apiary.hives[cm.pos.roomName];
      if (!hiveToBoos || cm.pos.roomName === cm.hiveName) {
        cm.delete();
        break;
      }

      if (!cm.fixedName(prefix.boost + cm.pos.roomName)) break;

      if (cm.hive.state !== hiveStates.economy) {
        hiveToBoos.bassboost = null;
        break;
      }

      if (hiveToBoos.bassboost) {
        if (cm.hive.phase > 0 && hiveToBoos.state === hiveStates.economy)
          cm.delete();
        break;
      }

      hiveToBoos.bassboost = cm.hive;
      hiveToBoos.cells.spawn.spawnQue = [];
      _.forEach(Apiary.masters, (c) => {
        if (c.hive.roomName === cm.pos.roomName) c.waitingForBees = 0;
      });
      break;
    }
  }
}

export function deleteAnnex(cm: FlagCommand) {
  switch (cm.secondaryColor) {
    case COLOR_WHITE: {
      const hiveBoosted = Apiary.hives[cm.pos.roomName];
      if (hiveBoosted) hiveBoosted.bassboost = null;
      break;
    }
  }
}
