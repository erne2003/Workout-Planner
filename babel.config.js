module.exports = function (api) {
  api.cache(true);
  
  // Only apply babel-preset-expo when we are running inside an Expo context.
  // Expo CLI always sets EXPO_ROUTER_APP_ROOT or EXPO_OS.
  const isExpo = process.env.EXPO_ROUTER_APP_ROOT || process.env.EXPO_OS || process.env.RCT_METRO_PORT;
  
  if (isExpo) {
    return {
      presets: ['babel-preset-expo'],
    };
  }
  
  return {};
};
