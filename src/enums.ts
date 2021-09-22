export enum hivePhases {
  economy = 0,
  lowenergy = 1,
  nospawn = 2,
  war = 5,
  nukealert = 6,
}

export enum enemyTypes {
  static = 0,
  moving = 1,
}

export enum roomStates {
  ownedByMe = 0,
  reservedByMe = 1,
  noOwner = 2,
  reservedByEnemy = 3,
  ownedByEnemy = 4,
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
