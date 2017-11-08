function getLocationHref() {
  return (document && document.location && document.location.href ? document.location.href : '');
}

console.log(getLocationHref());

(function () {
  'use strict';

  const chokidar = require('chokidar');

  function triggerReload() {
    console.warn('Reloading app...');

    if (location) {
      location.reload();
    }
  }

  if (window.location.href.indexOf('chrome') > -1) {
    const watcher = chokidar.watch('public', {
      ignored: /[\/\\]\./,
      persistent: true
    });
    let reloading = false;

    watcher.on('change', (path) => {
      if (path.indexOf('.css') > -1 || path.indexOf('.scss') > -1) {
        const styles = document.querySelectorAll('link[rel=stylesheet]');

        for (let x = 0, maxLen = styles.length; x < maxLen; x += 1) {
          const style = styles[x];
          const restyled = `${style.getAttribute('href')}?v=${Math.floor((Math.random() * 10000) + 1)}`;
          style.setAttribute('href', restyled);
        }
      } else if (!reloading) {
        reloading = true;
        setInterval(triggerReload, 100);
      }
    });
  }
}());
