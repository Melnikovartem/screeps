/**
 * Enum defining different states of the hive
 */
export enum hiveStates {
  economy = 0 /** Economy-focused state */,
  lowenergy = 1 /** Low energy state */,
  nospawn = 2 /** No spawn state */,
  nukealert = 6 /** Nuke alert state */,
  battle = 7 /** Battle state */,
}

/**
 * Enum defining different types of enemies
 */
export enum enemyTypes {
  static = 0 /** Static enemy type */,
  moving = 1 /** Moving enemy type */,
}

/**
 * Enum defining different states of a room
 */
export enum roomStates {
  ownedByMe = 1 /** Owned by the hive */,
  reservedByMe = 2 /** Reserved by the hive */,
  noOwner = 3 /** No owner */,
  corridor = 4 /** Corridor room */,
  SKcentral = 5 /** Stronghold central room */,
  SKfrontier = 6 /** Stronghold frontier room */,
  reservedByInvader = 7 /** Reserved by invader */,
  reservedByEnemy = 8 /** Reserved by enemy */,
  ownedByEnemy = 9 /** Owned by enemy */,
}

/**
 * Enum defining different states of a bee
 */
export enum beeStates {
  idle = 0 /** Idle state */,
  chill = 1 /** Chill state */,
  work = 2 /** Work state */,
  fflush = 3 /** Flush state */,
  refill = 4 /** Refill state */,
  boosting = 5 /** Boosting state */,
}

/**
 * Enum defining prefixes used for various purposes
 */
export enum prefix {
  // orders
  spotter = "spot_" /** Spotter prefix */,
  steal = "borrow_" /** Steal prefix */,
  build = "wax_" /** Build prefix */,
  surrender = "FFF_" /** Surrender prefix */,
  boost = "boost_" /** Boost prefix */,
  defSwarm = "protect_" /** Defensive swarm prefix */,
  claim = "claim_" /** Claim prefix */,
  downgrade = "downgrade_" /** Downgrade prefix */,

  // annexgang
  safesk = "sk_",
  reserve = "reserve_" /** Annex prefix */,
  containerBuilder = "contbuild_",

  // corridor mining
  depositMining = "deposit_" /** Deposit mining prefix */,
  pickup = "pickup_" /** Pickup prefix */,
  minerDep = "miner_" /** Deposit miner prefix */,
  powerMining = "bank_" /** Power bank mining prefix */,

  // cells
  defenseCell = "def" /** Defense hive cell prefix */,
  respawnCell = "spawn" /** Respawn cell prefix */,
  developmentCell = "dev" /** Development cell prefix */,
  excavationCell = "excav" /** Excavation cell prefix */,
  fastRefillCell = "fastref" /** Fast refill cell prefix */,
  laboratoryCell = "lab" /** Laboratory cell prefix */,
  resourceCells = "res" /** Resource cell prefix */,
  storageCell = "storage" /** Storage cell prefix */,
  upgradeCell = "upgrade" /** Upgrade cell prefix */,
  observerCell = "observe" /** Observer cell prefix */,
  powerCell = "power" /** Power hive cell prefix */,
  factoryCell = "factory" /** Factory cell prefix */,
  corridorMiningCell = "corridor" /** CorridorMining cell prefix */,
  buildingCell = "build",
  annexCell = "annex",

  // game constants
  master = "m_" /** Master prefix */,
  swarm = "swarm_" /** Swarm prefix */,

  nkvd = "NKVD'shnik" /** NKVD prefix */,
  kgb = "KGB'shnik" /** KGB prefix */,
}

/**
 * Enum defining different sign texts
 */
export enum signText {
  my = "🐝✨❤️" /** Sign text for owned rooms */,
  annex = "🐝⛏️🔥" /** Sign text for annexed rooms */,
  other = "🐝☠️🤖" /** Sign text for other rooms */,
}

/**
 * Enum defining setup names for different roles
 */
export enum setupsNames {
  // Civilian
  claimer = "Firefly" /** Claimer setup name */,
  scout = "Butterfly" /** Scout setup name */,
  // Base
  bootstrap = "Larva" /** Bootstrap setup name */,
  fastRefill = "Carpenter bee" /** Manager setup name */,
  managerQueen = "Queen bee" /** Queen setup name */,
  upgrader = "Honey bee" /** Upgrader setup name */,
  builder = "Mason bee" /** Builder setup name */,
  hauler = "Bumblebee" /** Hauler setup name */,
  depositHauler = "Garden bumblebee" /** Deposit hauler setup name */,
  // Mining
  minerEnergy = "Scarabaeus sacer" /** Energy miner setup name */,
  minerMinerals = "Japanese beetle" /** Minerals miner setup name */,
  depositMinerMiner = "Ground beetle" /** Deposit miner (miner) setup name */,
  depositMinerPuller = "Dragonfly" /** Deposit miner (puller) setup name */,
  powerMinerAttacker = "Hercules beetle" /** Power miner (attacker) setup name */,
  powerMinerHealer = "Atlas moth" /** Power miner (healer) setup name */,
  // War
  downgrader = "Housefly" /** Downgrader setup name */,
  healer = "Luna moth" /** Healer setup name */,
  archer = "European hornet" /** Archer setup name */,
  knight = "Red paper wasp" /** Knight setup name */,
  dismantler = "Assasin bug" /** Dismantler setup name */,
  defender = "Walking stick" /** Defender setup name */,
  destroyer = "Leaf insect" /** Destroyer setup name */,
  skdefender = "Orchid Mantis" /** Stronghold defender setup name */,
}

// Infantry
// Lady bug / Carpenter ant / Earthworm / Black widow
// Nomadic ants (new update)
