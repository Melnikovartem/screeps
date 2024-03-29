import { ClaimerMaster } from "beeMasters/civil/claimer";
import { ClearMaster } from "beeMasters/civil/clear";
import { ContainerBuilderMaster } from "beeMasters/civil/containerBuilder";
import { HelpTransferMaster } from "beeMasters/civil/helpTransfer";
import { HelpUpgradeMaster } from "beeMasters/civil/helpUpgrade";
import { PickupMaster } from "beeMasters/civil/pickup";
import { PortalMaster } from "beeMasters/civil/portal";
import { PuppetMaster } from "beeMasters/civil/puppet";
import { DepositMaster } from "beeMasters/corridorMining/deposit";
import { PowerMiningMaster } from "beeMasters/corridorMining/power";
import { AnnexMaster } from "beeMasters/economy/annexer";
import { SquadWarCrimesMaster } from "beeMasters/squads/squadWarcrimes";
import { DowngradeMaster } from "beeMasters/war/downgrader";
import { HordeMaster } from "beeMasters/war/horde";
import { HordeDefenseMaster } from "beeMasters/war/hordeDefense";
import { SKMaster } from "beeMasters/war/safeSK";

import { SWARM_MASTER } from "./swarm-nums";

export const SWARM_ORDER_TYPES = {
  [SWARM_MASTER.annex]: AnnexMaster,
  [SWARM_MASTER.sk]: SKMaster,
  [SWARM_MASTER.hordedefense]: HordeDefenseMaster,

  [SWARM_MASTER.claimer]: ClaimerMaster,
  [SWARM_MASTER.clear]: ClearMaster,
  [SWARM_MASTER.containerbuilder]: ContainerBuilderMaster,
  [SWARM_MASTER.helptransfer]: HelpTransferMaster,
  [SWARM_MASTER.helpupgrade]: HelpUpgradeMaster,
  [SWARM_MASTER.pickup]: PickupMaster,
  [SWARM_MASTER.portal]: PortalMaster,
  [SWARM_MASTER.puppet]: PuppetMaster,

  [SWARM_MASTER.depositmining]: DepositMaster,
  [SWARM_MASTER.powermining]: PowerMiningMaster,

  [SWARM_MASTER.horde]: HordeMaster,
  // requires extra info in memory by hand
  [SWARM_MASTER.squadwarcrimes]: SquadWarCrimesMaster,
  [SWARM_MASTER.downgrader]: DowngradeMaster,
};
