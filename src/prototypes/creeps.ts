interface Creep {
  getBodyparts(partType: BodyPartConstant): number;
}

Creep.prototype.getBodyparts = function(partType) {
  return _.filter(this.body, (part: BodyPartDefinition) => part.type == partType).length;
};
