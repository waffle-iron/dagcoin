#!/usr/bin/env node

const fs = require('fs');
const shell = require('shelljs');

const getCommitHash = () => {
// exec git command to get the hash of the current commit
// git rev-parse HEAD

  const hash = shell.exec('git rev-parse HEAD', {
    silent: true,
  }).output.trim().substr(0, 7);

  return (hash === 'fatal: ' ? 'n/a' : hash);
};

const commitHash = getCommitHash();
const json = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
console.log(`v${json.version} #${commitHash}`);

const content = `window.version="${json.version}";\nwindow.commitHash="${commitHash}";`;
fs.writeFileSync('./src/js/version.js', content);
