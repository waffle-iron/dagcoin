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
if ! type bower > /dev/null; then
  echo "${Red}* ERROR. Please install bower${CloseColor}"
  echo "${Red}* npm install -g bower${CloseColor}"
  exit
fi
if ! type grunt > /dev/null; then
  echo "${Red}* ERROR. Please install grunt${CloseColor}"
  echo "${Red}* npm install -g grunt-cli${CloseColor}"
  exit
fi
if ! type penv > /dev/null; then
  echo "${Red}* ERROR. Please install penv${CloseColor}"
  echo "${Red}* npm install -g penv${CloseColor}"
  exit
fi

Sqlite3Path='./node_modules/sqlite3/lib/binding'

if [ "$(uname)" == "Darwin" ]; then
 PackagePath='../byteballbuilds/DAGCOIN/osx64/DAGCOIN.app/Contents/Resources/app.nw/'
 Action=dmg
elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then
 PackagePath='../byteballbuilds/Dagcoin/linux64/'
 Action=linux64
fi

grunt desktop:$1

if [ -d "./node_modules" ]; then
  echo "Moving existing node_modules to temp ..."
  mv "./node_modules" "./node_modules-temp"
fi

echo "Installing production dependencies..."

npm install --production

echo "Copying ..."

if [ "$(uname)" == "Darwin" ]; then
  if [ -d "${Sqlite3Path}/node-webkit-v0.14.7-darwin-x64" ]; then
    grunt
    exit
  fi
  mkdir "${Sqlite3Path}/node-webkit-v0.14.7-darwin-x64"
  cp "${Sqlite3Path}/node-v47-darwin-x64/node_sqlite3.node" "${Sqlite3Path}/node-webkit-v0.14.7-darwin-x64"
elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then
  if [ -d "${Sqlite3Path}/node-webkit-v0.14.7-linux-x64" ]; then
    grunt
    exit
  fi
  mkdir "${Sqlite3Path}/node-webkit-v0.14.7-linux-x64"
  cp "${Sqlite3Path}/node-v47-linux-x64/node_sqlite3.node" "${Sqlite3Path}/node-webkit-v0.14.7-linux-x64"
fi

cp -r "./node_modules" "${PackagePath}"

rm -rf "./node_modules"

if [ -d "./node_modules-temp" ]; then
  echo "Moving temp node_modules back ..."
  mv "./node_modules-temp" "./node_modules"
fi

grunt

grunt ${Action}
