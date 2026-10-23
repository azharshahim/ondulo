// Configuration Babel : babel-preset-expo + plugin Worklets (requis par Reanimated 4).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
