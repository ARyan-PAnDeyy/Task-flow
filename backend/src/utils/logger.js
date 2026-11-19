const config = require('../config');

/* Minimal leveled logger; silent during tests to keep output clean. */
const write = (level, args) => {
  if (config.isTest) return;
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()}:`;
  // eslint-disable-next-line no-console
  (level === 'error' ? console.error : console.log)(line, ...args);
};

module.exports = {
  info: (...args) => write('info', args),
  warn: (...args) => write('warn', args),
  error: (...args) => write('error', args),
};
