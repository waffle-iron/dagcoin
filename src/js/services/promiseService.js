/* eslint-disable import/no-unresolved */
(function () {
  'use strict';

  angular.module('copayApp.services').factory('promiseService', () => {
    const root = {};

    root.objRequest = null;

    root.FOREVER = -1;

    root.timedPromise = function (promise, timeout, timeoutMessage) {
      let timeoutId = null;
      let message = timeoutMessage;

      if (!message) {
        message = 'TIMEOUT WHILE WAITING FOR THE PROMISE TO RESOLVE';
      }

      return Promise.race([
        promise,
        new Promise((resolve, reject) => {
          timeoutId = setTimeout(() => {
            reject(message);
          }, timeout);
        })
      ]).then(
        (result) => {
          clearTimeout(timeoutId);
          return Promise.resolve(result);
        }, (error) => {
          clearTimeout(timeoutId);
          return Promise.reject(error);
        }
      );
    };

    /**
     * Takes a promise, provides it with a timeout and repeats it when the timeout fires.
     * Gives up after several attempts
     * @param promise A promise to be fulfilled before a timeout.
     * @param timeout How long the promise can wait before being rejected and, possibly, reattempted.
     * @param times How many times the promsie should be attempted? promiseService.FOREVER to try forever.
     * @param timeoutMessages A JSON structure with timeoutMessage and finalTimeoutMessage
     * @returns {Promise.<T>|*}
     */
    root.repeatedTimedPromise = function (promise, timeout, times, timeoutMessages) {
      let finalTimeoutMessage = 'NO MORE ATTEMPTS';
      let timeoutMessage = null;

      if (timeoutMessages) {
        finalTimeoutMessage = timeoutMessages.finalTimeoutMessage;
        timeoutMessage = timeoutMessages.timeoutMessage;
      }

      if (!finalTimeoutMessage) {
        finalTimeoutMessage = 'NO MORE ATTEMPTS';
      }

      return root.timedPromise(promise, timeout, timeoutMessage).catch((error) => {
        if (times > 0 || times === root.FOREVER) {
          console.log(`${error} ... TRYING AGAIN`);
          return root.repeatedTimedPromise(promise, timeout, times - 1, timeoutMessages);
        }

        return Promise.reject(finalTimeoutMessage);
      });
    };

    root.counter = 0;

    root.nextId = function () {
      const id = root.counter;
      root.counter += 1;
      return id;
    };

    /**
     * Listens to a generic event waiting for a certain instance of it with specific attributes analysed in the condition.
     * Returns a promise that is rejected after a timeout.
     * @param event An bus event name to listen to. Can be a generic event issue many times.
     * @param condition A function that takes the event parameters as input and outputs a true value if the
     * event is the one expected (true in the simplest case, any complex non-false value in others) to be returned by the promise
     * when it resolves positively.
     * The expectation is based on the event parameters (i.e.: some id or other properties of the event).
     * Be careful:
     * * 0 is false
     * * false is false
     * * null is false
     * * 1 is true
     * * an array or an object are true
     * If you need to return a false value which means true you have to wrap it with a true wrapper
     * * i.e.: return {'result': false}
     * @param timeout A timeout after which the promise naturally expires.
     * @param timeoutMessage An error message to be returned by reject when the timeout is met.
     */
    root.listeningTimedPromise = function (event, condition, timeout, timeoutMessage) {
      const eb = require('byteballcore/event_bus');

      const uniqueInternalEvent = `internal.dagcoin.${root.nextId()}`;

      const listener = function (...args) {
        const resolutionValue = condition(args);

        if (!resolutionValue) {
          console.log(`IGNORING USELESS EVENT ${event}`);
          return;
        }

        eb.emit(uniqueInternalEvent, resolutionValue);
      };

      eb.on(event, listener);

      const promise = new Promise((resolve) => {
        eb.once(uniqueInternalEvent, resolve);
      });

      return root.timedPromise(promise, timeout, timeoutMessage)
        .then(
          (args) => {
            console.log(`REMOVING THE INTERNAL LISTENER FROM ${event}`);
            eb.removeListener(event, listener);
            return Promise.resolve(args);
          },
          (err) => {
            console.log(`REMOVING THE INTERNAL LISTENER FROM ${event}`);
            eb.removeListener(event, listener);
            return Promise.reject(err);
          }
        );
    };

    return root;
  });
}());
