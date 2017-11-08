/* eslint-disable no-undef */
const lodash = require('lodash');
/**
 * @desc
 * A simple logger that wraps the <tt>console.log</tt> methods when available.
 *
 * Usage:
 * <pre>
 *   log = new Logger('copay');
 *   log.setLevel('info');
 *   log.debug('Message!'); // won't show
 *   log.setLevel('debug');
 *   log.debug('Message!', 1); // will show '[debug] copay: Message!, 1'
 * </pre>
 *
 * @param {string} name - a name for the logger. This will show up on every log call
 * @constructor
 */

const levels = {
  debug: 0,
  info: 1,
  log: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

const Logger = function (name) {
  this.name = name || 'log';
  this.level = 2;
};

Logger.prototype.getLevels = function () {
  return levels;
};


lodash.each(levels, (level, levelName) => {
  Logger.prototype[levelName] = function (...args) {
    if (level >= levels[this.level]) {
      let caller = '';
      if (Error.stackTraceLimit && this.level === 'debug') {
        const old = Error.stackTraceLimit;
        Error.stackTraceLimit = 2;
        let stack;

        // this hack is to be compatible with IE11
        try {
          anerror();
        } catch (e) {
          stack = e.stack;
        }
        const lines = stack.split('\n');
        caller = lines[2];
        caller = `:${caller.substr(6)}`;
        Error.stackTraceLimit = old;
      }

      let str = `[${levelName}${caller}] ${args[0]}`;
      const extraArgs = [].slice.call(args, 1);
      if (console[levelName]) {
        extraArgs.unshift(str);
        console[levelName](...extraArgs);
      } else {
        if (extraArgs.length) {
          str += JSON.stringify(extraArgs);
        }
        console.log(str);
      }
    }
  };
});

/**
 * @desc
 * Sets the level of a logger. A level can be any bewteen: 'debug', 'info', 'log',
 * 'warn', 'error', and 'fatal'. That order matters: if a logger's level is set to
 * 'warn', calling <tt>level.debug</tt> won't have any effect.
 *
 * @param {number} level - the name of the logging level
 */
Logger.prototype.setLevel = function (level) {
  this.level = level;
};

/**
 * @class Logger
 * @method debug
 * @desc Log messages at the debug level.
 * @param {*} args - the arguments to be logged.
 */
/**
 * @class Logger
 * @method info
 * @desc Log messages at the info level.
 * @param {*} args - the arguments to be logged.
 */
/**
 * @class Logger
 * @method log
 * @desc Log messages at an intermediary level called 'log'.
 * @param {*} args - the arguments to be logged.
 */
/**
 * @class Logger
 * @method warn
 * @desc Log messages at the warn level.
 * @param {*} args - the arguments to be logged.
 */
/**
 * @class Logger
 * @method error
 * @desc Log messages at the error level.
 * @param {*} args - the arguments to be logged.
 */
/**
 * @class Logger
 * @method fatal
 * @desc Log messages at the fatal level.
 * @param {*} args - the arguments to be logged.
 */

const logger = new Logger('dagcoin');
logger.setLevel('info');
module.exports = logger;
