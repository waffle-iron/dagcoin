#!/bin/bash

Green='\033[0;32m'
Red='\033[0;31m'
CloseColor='\033[0m'

NodeVersion="v5.12.0"
Sqlite3Path='./node_modules/sqlite3/lib/binding'
PackagePath='../byteballbuilds/DAGCOIN/osx64/DAGCOIN.app/Contents/Resources/app.nw/'

if ! node -v | grep -q ${NodeVersion}; then
 echo "${Red}* ERROR. Please use Node v5.12.0...${CloseColor}"
 exit
fi

echo "${Green}* Node version OK${CloseColor}"

grunt desktop:$1
if [ -d "./node_modules" ]; then
  echo "Moving existing node_modules to temp ..."
  mv "./node_modules" "./node_modules-temp"
fi

echo "Installing production dependencies..."

npm install --production

echo "Copying ..."

if [ ! -d "${PackagePath}" ]; then
  echo "${Red}* ERROR. ${PackagePath} doesn't exists. Please make sure that grunt desktop task was executed properly...${CloseColor}"
  exit
fi

mkdir "${Sqlite3Path}/node-webkit-v0.14.7-darwin-x64"

cp "${Sqlite3Path}/node-v47-darwin-x64/node_sqlite3.node" "${Sqlite3Path}/node-webkit-v0.14.7-darwin-x64"

cp -r "./node_modules" "${PackagePath}"

rm -rf "./node_modules"

if [ -d "./node_modules-temp" ]; then
  echo "Moving temp node_modules back ..."
  mv "./node_modules-temp" "./node_modules"
fi

grunt

grunt dmg
