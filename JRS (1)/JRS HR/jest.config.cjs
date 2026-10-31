module.exports = {
  testEnvironment: 'node',
  // Regex also works from Windows directories containing hidden/path-dot segments.
  testRegex: '[/\\\\]tests[/\\\\][^/\\\\]+\\.test\\.cjs$',
  transform: {},
  clearMocks: true
};
