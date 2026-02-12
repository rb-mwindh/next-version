class Bumper {
  constructor() {}
  tag() { return this; }
  loadPreset() { return this; }
  async bump() { return { releaseType: 'patch' }; }
}
module.exports = { Bumper };

