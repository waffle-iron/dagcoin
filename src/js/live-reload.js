if(window.location.href.indexOf('chrome') > -1){
    var chokidar = require('chokidar');
    var watcher  = chokidar.watch('.', {ignored: /[\/\\]\./});
    var reloading = false;

    function triggerReload(){

        console.warn('Reloading app...');

        if(location){
            location.reload();
        }

    }

    watcher.on('all', function(event, path) {
        if (event == "change" && path && (path.indexOf('public/')  > -1 || path.indexOf('src/') > -1)){

            if(path.indexOf('.css') > -1 || path.indexOf('.scss') > -1){
                var styles = document.querySelectorAll('link[rel=stylesheet]');

                for (var i = 0; i < styles.length; i++) {
                    // reload styles
                    var restyled = styles[i].getAttribute('href') + '?v='+Math.random(0,10000);
                    styles[i].setAttribute('href', restyled);
                }
            }else{
                if(!reloading){
                    reloading = true;
                    setInterval(triggerReload, 100);
                }
            }
        }

    });
}