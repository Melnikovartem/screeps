interface Creep {
  getBodyParts(partType: BodyPartConstant, boosted?: 1 | 0 | -1): number;
}

Creep.prototype.getBodyParts = function(partType, boosted: 1 | 0 | -1 = 0) {
  return _.filter(this.body, (part: BodyPartDefinition) => part.type === partType && (!boosted || (boosted === 1 ? part.boost : !part.boost))).length;
};
