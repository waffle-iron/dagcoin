VERSION=`cut -d '"' -f2 $BUILDDIR/../version.js`

prepare-dev:
	sh devbuilds/prepare-dev.sh

prepare-package:
	sh devbuilds/prepare-package.sh live

prepare-package-tn:
	sh devbuilds/prepare-package.sh testnet


cordova-base:
	grunt dist-mobile

# ios:  cordova-base
# 	make -C cordova ios
# 	open cordova/project/platforms/ios/Copay
#
# android: cordova-base
# 	make -C cordova run-android
#
# release-android: cordova-base
# 	make -C cordova release-android
#
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

android-debug-tn:
	cordova/build.sh ANDROID dagcoin-tn --dbgjs --clear
#	cp ./etc/beep.ogg ./cordova/project/plugins/phonegap-plugin-barcodescanner/src/android/LibraryProject/res/raw/beep.ogg
#	cd ../byteballbuilds/project-ANDROID-tn  && cordova run android --device

android-debug-emulator:
	cordova/build.sh ANDROID dagcoin --dbgjs --clear
#	cp ./etc/beep.ogg ./cordova/project/plugins/phonegap-plugin-barcodescanner/src/android/LibraryProject/res/raw/beep.ogg
	cd ../byteballbuilds/project-ANDROID  && cordova emulate android

android-debug-emulator-tn:
	cordova/build.sh ANDROID dagcoin-tn --dbgjs --clear
#	cp ./etc/beep.ogg ./cordova/project/plugins/phonegap-plugin-barcodescanner/src/android/LibraryProject/res/raw/beep.ogg
	cd ../byteballbuilds/project-ANDROID-tn  && cordova emulate android

android-debug-fast:
	cordova/build.sh ANDROID dagcoin --dbgjs
#	cp ./etc/beep.ogg ./cordova/project/plugins/phonegap-plugin-barcodescanner/src/android/LibraryProject/res/raw/beep.ogg
	cd ../byteballbuilds/project-ANDROID && cordova run android --device
#	cd ../byteballbuilds/project-ANDROID && cordova build android

android-debug-fast-tn:
	cordova/build.sh ANDROID dagcoin-tn --dbgjs
#	cp ./etc/beep.ogg ./cordova/project/plugins/phonegap-plugin-barcodescanner/src/android/LibraryProject/res/raw/beep.ogg
	cd ../byteballbuilds/project-ANDROID-tn && cordova run android --device

android-debug-fast-emulator:
	cordova/build.sh ANDROID dagcoin --dbgjs
#	cp ./etc/beep.ogg ./cordova/project/plugins/phonegap-plugin-barcodescanner/src/android/LibraryProject/res/raw/beep.ogg
	cd ../byteballbuilds/project-ANDROID && cordova emulate android

android-debug-fast-emulator-tn:
	cordova/build.sh ANDROID dagcoin-tn --dbgjs
#	cp ./etc/beep.ogg ./cordova/project/plugins/phonegap-plugin-barcodescanner/src/android/LibraryProject/res/raw/beep.ogg
	cd ../byteballbuilds/project-ANDROID-tn && cordova emulate android
