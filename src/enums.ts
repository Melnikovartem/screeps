export enum hiveStates {
  economy = 0,
  lowenergy = 1,
  nospawn = 2,
  nukealert = 6,
  battle = 7,
}

export enum enemyTypes {
  static = 0,
  moving = 1,
}

export enum roomStates {
  ownedByMe = 0,
  reservedByMe = 1,
  noOwner = 2,
  corridor = 3,
  SKcentral = 4,
  SKfrontier = 5,
  reservedByInvaider = 6,
  reservedByEnemy = 7,
  ownedByEnemy = 8,
}

export enum beeStates {
  idle = 0,
  chill = 1,
  work = 2,
  fflush = 3,
  refill = 4,
  boosting = 5,
  flee = 6,
}

export enum prefix {
  // orders
  upgrade = "polen",
  surrender = "FFF",
  boost = "boost_",
  def = "def_",
  puppet = "pup_",
  annex = "annex_",

  //cells
  defenseCell = "DefenseCell_",
  respawnCell = "RespawnCell_",
  developmentCell = "DevelopmentCell_",
  excavationCell = "ExcavationCell_",
  laboratoryCell = "LaboratoryCell_",
  resourceCells = "ResourceCell_",
  storageCell = "StorageCell_",
  upgradeCell = "UpgradeCell_",
  observerCell = "ObserveCell_",
  powerCell = "PowerCell_",


  // game constants
  master = "master",
  swarm = "Swarm_",
}
