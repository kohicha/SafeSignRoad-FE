import React, { useState, } from "react";
import { TouchableOpacity, Alert, View, Text, Linking, ImageBackground } from "react-native";
import { Audio } from 'expo-av';
import { Link } from 'expo-router';
import { useNavigation } from "@react-navigation/native"

const index = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const navigation = useNavigation();

  const requestPermissions = async () => {
    try {

      const { status: micStatus } = await Audio.requestPermissionsAsync();
      if (micStatus !== "granted") {
        return Alert.alert(
          "Microphone Permission Required",
          "Please enable microphone access in settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
      }

      setIsEnabled(true);
      Alert.alert("Permissions Granted", "Microphone access enabled!");
    } catch (error) {
      console.error("Permission request error:", error);
    }
  };

  const disableDetection = async () => {
    setIsEnabled(false);
    setTimeout(() => {
      Alert.alert(
        "Detection Stopped",
        "To fully disable microphone and notifcation access, please update your device settings.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open Settings",
            onPress: () => Linking.openSettings(),
          },
        ]
      );
    }, 100);
  };

  const confirmDisable = () => {
    Alert.alert(
      "Disable Detection",
      "Are you sure you want to stop the app from detecting vehicle horns?",
      [
        { text: "No", style: "cancel" },
        { text: "Yes", onPress: disableDetection },
      ]
    );
  };

  return (
    <ImageBackground source={require("../assets/images/bg.png")} style={{ flex: 1 }} resizeMode="cover">
      <View className=" items-center h-full justify-center mt-[135px] gap-2 " >

        < Link href='./pages/Detector' asChild >
          <TouchableOpacity
            className="bg-[#fbd713] rounded-lg py-4 px-6 flex-row items-center justify-center min-w-[250px]"
            activeOpacity={0.8}
          >
            <Text className="text-black  text-3xl font-bold " > DETECT</Text>
          </TouchableOpacity>
        </Link>

        <TouchableOpacity
          className="bg-[#fbd713] rounded-lg py-4 px-6 flex-row items-center justify-center min-w-[250px]"
          activeOpacity={0.8}
          onPress={requestPermissions}
        >
          <Text className="text-black  text-3xl font-bold " > ENABLE </Text>
        </TouchableOpacity>

        < TouchableOpacity
          className="bg-[#fbd713] rounded-lg py-4 px-6 flex-row items-center justify-center min-w-[250px]"
          activeOpacity={0.8}
          onPress={confirmDisable}
        >
          <Text className="text-black  text-3xl font-bold " > DISABLE </Text>
        </TouchableOpacity>

        < Link href='./pages/Settings' asChild >
          <TouchableOpacity
            className="bg-[#fbd713] rounded-lg py-4 px-6 flex-row items-center justify-center min-w-[250px]"
            activeOpacity={0.8}
          >
            <Text className="text-black  text-3xl font-bold " > SETTINGS </Text>
          </TouchableOpacity>
        </Link>

        <Link href='pages/about' asChild>
          < TouchableOpacity
            className="bg-[#fbd713] rounded-lg py-4 px-6 flex-row items-center justify-center min-w-[250px]"
            activeOpacity={0.8}
          >
            <Text className="text-black  text-3xl font-bold " > ABOUT </Text>
          </TouchableOpacity>
        </Link>

        <Link href='pages/Instructions' asChild>
          < TouchableOpacity
            className="bg-[#fbd713] rounded-lg py-4 px-6 flex-row items-center justify-center min-w-[250px]"
            activeOpacity={0.8}
          >
            <Text className="text-black  text-3xl font-bold " > INSTRUCTIONS </Text>
          </TouchableOpacity>
        </Link>

      </View>
    </ImageBackground>
  );
};


export default index;
