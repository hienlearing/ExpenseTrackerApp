// ExpenseTrackerApp/babel.config.js

module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo', '@babel/preset-flow'], // Thêm '@babel/preset-flow' vào đây
  };
};
