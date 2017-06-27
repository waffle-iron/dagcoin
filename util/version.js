#!/usr/bin/env node
'use strict';

const fs = require('fs');
const shell = require('shelljs');

const getCommitHash = function () {
	// exec git command to get the hash of the current commit
	// git rev-parse HEAD

  const hash = shell.exec('git rev-parse HEAD', {
    silent: true,
  }).output.trim().substr(0, 7);
  if (hash === 'fatal: ') { return 'n/a'; }
  return hash;
};

const commitHash = getCommitHash();
const json = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
console.log(`v${json.version} #${commitHash}`);

let content = `window.version="${json.version}";`;
content = `${content}\nwindow.commitHash="${commitHash}";`;
fs.writeFileSync('./src/js/version.js', content);
