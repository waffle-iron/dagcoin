#!/bin/bash
Green='\033[0;32m'
Red='\033[0;31m'
CloseColor='\033[0m'

NodeVersion="v5.12.0"
echo "${Green}* Checking Node version...${CloseColor}"
if ! node -v | grep -q ${NodeVersion}; then
 echo "${Red}* ERROR. Please use Node v5.12.0...${CloseColor}"
 exit
fi
echo "${Green}* Node version OK${CloseColor}"
echo "${Green}* Installing dependencies...${CloseColor}"
npm install

Sqlite3Path='./node_modules/sqlite3/lib/binding'

if [ -d "${Sqlite3Path}/node-webkit-v0.14.7-darwin-x64" ]; then
  grunt
  exit
fi
mkdir "${Sqlite3Path}/node-webkit-v0.14.7-darwin-x64"
cp "${Sqlite3Path}/node-v47-darwin-x64/node_sqlite3.node" "${Sqlite3Path}/node-webkit-v0.14.7-darwin-x64"
grunt
