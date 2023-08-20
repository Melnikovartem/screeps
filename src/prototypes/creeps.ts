interface Creep {
  getBodyParts(
    partType: BodyPartConstant,
    boosted?: 1 | 0 | -1,
    active?: boolean
  ): number;
}

Creep.prototype.getBodyParts = function (
  partType,
  boosted: 1 | 0 | -1 = 0,
  active: boolean = false
) {
  return _.filter(
    this.body,
    (part: BodyPartDefinition) =>
      part.type === partType &&
      (!active || part.hits > 0) &&
      (!boosted || (boosted === 1 ? part.boost : !part.boost))
  ).length;
};
