interface Creep {
  getBodyParts(partType: BodyPartConstant): number;
}

Creep.prototype.getBodyParts = function(partType) {
  return _.filter(this.body, (part: BodyPartDefinition) => part.type == partType).length;
};
