module.exports = function (api) {
  api.cache(true);
  const plugins = [
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: '.env',
        safe: false,
        allowUndefined: true,
      },
    ],
  ];
  // Do not use api.env() here: it uses cache.using() and conflicts with api.cache(true)
  // ("Caching has already been configured with .never or .forever()").
  if (process.env.NODE_ENV === 'production') {
    plugins.push(['transform-remove-console', {exclude: ['error', 'warn']}]);
  }
  plugins.push('react-native-reanimated/plugin');
  return {
    presets: ['module:@react-native/babel-preset'],
    plugins,
  };
};
