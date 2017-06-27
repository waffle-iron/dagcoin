#!/usr/bin/env node


const fs = require('fs');
const path = require('path');
const https = require('https');
const bhttp = require('bhttp');

const crowdin_identifier = 'byteball';

const local_file_name1 = path.join(__dirname, 'po/template.pot');

// Similar to Github, normalize all line breaks to CRLF so that different people
// using different OSes to update does not constantly swith format back and forth.
let local_file1_text = fs.readFileSync(local_file_name1, 'utf8');
local_file1_text = local_file1_text.replace(/\r\n/g, '\n');
local_file1_text = local_file1_text.replace(/\n/g, '\r\n');
fs.writeFileSync(local_file_name1, local_file1_text);

const local_file1 = fs.createReadStream(local_file_name1);

const local_file_name2 = path.join(__dirname, 'docs/appstore_en.txt');

let local_file2_text = fs.readFileSync(local_file_name2, 'utf8');
local_file2_text = local_file2_text.replace(/\r\n/g, '\n');
local_file2_text = local_file2_text.replace(/\n/g, '\r\n');
fs.writeFileSync(local_file_name2, local_file2_text);

const local_file2 = fs.createReadStream(local_file_name2);

const local_file_name3 = path.join(__dirname, 'docs/updateinfo_en.txt');

let local_file3_text = fs.readFileSync(local_file_name3, 'utf8');
local_file3_text = local_file3_text.replace(/\r\n/g, '\n');
local_file3_text = local_file3_text.replace(/\n/g, '\r\n');
fs.writeFileSync(local_file_name3, local_file3_text);

const local_file3 = fs.createReadStream(local_file_name3);

// obtain the crowdin api key
const crowdin_api_key = fs.readFileSync(path.join(__dirname, 'crowdin_api_key.txt'));
// console.log('api key: ' + crowdin_api_key);

if (crowdin_api_key != '') {
  const payload = {
    'files[template.pot]': local_file1,
    'files[appstore/appstore_en.txt]': local_file2,
    'files[appstore/updateinfo_en.txt]': local_file3,
  };

  bhttp.post(`https://api.crowdin.com/api/project/${crowdin_identifier}/update-file?key=${crowdin_api_key}`, payload, {}, (err, response) => {
    console.log('\nResponse from update file call:\n', response.body.toString());

    // This call will tell the server to generate a new zip file for you based on most recent translations.
    https.get(`https://api.crowdin.com/api/project/${crowdin_identifier}/export?key=${crowdin_api_key}`, (res) => {
      console.log(`Export Got response: ${res.statusCode}`);
      res.on('data', (chunk) => {
        console.log(chunk.toString('utf8'));
      });
    }).on('error', (e) => {
      console.log(`Export Got error: ${e.message}`);
    });
  });
}
