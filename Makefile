VERSION=`cut -d '"' -f2 $BUILDDIR/../version.js`

UNAME := $(shell uname)

ifeq ($(UNAME), Linux)
  # do something Linux-y
  SHELLCMD := bash
endif

ifeq ($(UNAME), Darwin)
  # do something MAC
  SHELLCMD := sh
endif

prepare-dev:
	$(SHELLCMD) devbuilds/prepare-dev.sh base

prepare-dev-tn:
	$(SHELLCMD) devbuilds/prepare-dev.sh testnet

prepare-package:
	$(SHELLCMD) devbuilds/prepare-package.sh live

prepare-package-tn:
	$(SHELLCMD) devbuilds/prepare-package.sh testnet

cordova-base:
	grunt dist-mobile

wp8-prod:
	cordova/build.sh WP8 --clear
	cordova/wp/fix-svg.sh
	echo -e "\a"

wp8-debug:
	cordova/build.sh WP8 --dbgjs
	cordova/wp/fix-svg.sh
	echo -e "\a"

ios-prod:
	cordova/build.sh IOS --clear
	cd ../byteballbuilds/project-IOS-tn && cordova build ios
#	open ../byteballbuilds/project-IOS-tn/platforms/ios/Byteball.xcodeproj

ios-debug:
	cordova/build.sh IOS --dbgjs
	cd ../byteballbuilds/project-IOS  && cordova build ios
	open ../byteballbuilds/project-IOS /platforms/ios/Byteball.xcodeproj

android-prod:
	cordova/build.sh ANDROID dagcoin --clear
#	cp ./etc/beep.ogg ./cordova/project/plugins/phonegap-plugin-barcodescanner/src/android/LibraryProject/res/raw/beep.ogg
	cd ../byteballbuilds/project-ANDROID  && cordova build --release android
#   keytool -genkey -v -keystore <keystore_name>.keystore -alias <keystore alias> -keyalg RSA -keysize 2048 -validity 10000
	jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore dagcoin.jks -tsa http://sha256timestamp.ws.symantec.com/sha256/timestamp -signedjar ../byteballbuilds/project-ANDROID/platforms/android/build/outputs/apk/android-release-signed.apk  ../byteballbuilds/project-ANDROID/platforms/android/build/outputs/apk/android-release-unsigned.apk dagcoin
	$(ANDROID_HOME)/build-tools/25.0.3/zipalign -v 4 ../byteballbuilds/project-ANDROID/platforms/android/build/outputs/apk/android-release-signed.apk ../byteballbuilds/project-ANDROID/platforms/android/build/outputs/apk/android-release-signed-aligned.apk

android-debug:
	cordova/build.sh ANDROID dagcoin --dbgjs --clear
#	cp ./etc/beep.ogg ./cordova/project/plugins/phonegap-plugin-barcodescanner/src/android/LibraryProject/res/raw/beep.ogg
	cd ../byteballbuilds/project-ANDROID  && cordova run android --device

android-debug-emulator:
	cordova/build.sh ANDROID dagcoin --dbgjs --clear
#	cp ./etc/beep.ogg ./cordova/project/plugins/phonegap-plugin-barcodescanner/src/android/LibraryProject/res/raw/beep.ogg
	cd ../byteballbuilds/project-ANDROID  && cordova emulate android

android-debug-fast:
	cordova/build.sh ANDROID dagcoin --dbgjs
#	cp ./etc/beep.ogg ./cordova/project/plugins/phonegap-plugin-barcodescanner/src/android/LibraryProject/res/raw/beep.ogg
	cd ../byteballbuilds/project-ANDROID && cordova run android --device
#	cd ../byteballbuilds/project-ANDROID && cordova build android

android-debug-fast-emulator:
	cordova/build.sh ANDROID dagcoin --dbgjs
#	cp ./etc/beep.ogg ./cordova/project/plugins/phonegap-plugin-barcodescanner/src/android/LibraryProject/res/raw/beep.ogg
	cd ../byteballbuilds/project-ANDROID && cordova emulate android
