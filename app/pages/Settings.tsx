import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Vibration, TextInput } from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SettingsScreen = () => {
  const navigation = useNavigation();
  const [fontSize, setFontSize] = useState(14);
  const [vibrationDuration, setVibrationDuration] = useState(500);
  const [fontSizeInput, setFontSizeInput] = useState("14");
  const [vibrationInput, setVibrationInput] = useState("500");

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedFontSize = await AsyncStorage.getItem("fontSize");
        if (storedFontSize !== null) {
          const parsedFontSize = Number.parseInt(storedFontSize, 10);
          setFontSize(parsedFontSize);
          setFontSizeInput(parsedFontSize.toString());
        }

        const storedVibration = await AsyncStorage.getItem("vibrationDuration");
        if (storedVibration !== null) {
          const parsedVibration = Number.parseInt(storedVibration, 10);
          setVibrationDuration(parsedVibration);
          setVibrationInput(parsedVibration.toString());
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };

    loadSettings();
  }, []);

  const saveFontSize = async (value: number) => {
    try {
      await AsyncStorage.setItem("fontSize", value.toString());
      setFontSize(value);
      setFontSizeInput(value.toString());
    } catch (error) {
      console.error("Error saving font size:", error);
    }
  };

  const saveVibrationDuration = async (value: number) => {
    try {
      await AsyncStorage.setItem("vibrationDuration", value.toString());
      setVibrationDuration(value);
      setVibrationInput(value.toString());

      // Trigger vibration when value is saved
      if (value > 0) {
        Vibration.vibrate(value);
        console.log(`Vibrating for ${value}ms`);
      } else {
        console.log("Vibration Disabled");
      }
    } catch (error) {
      console.error("Error saving vibration duration:", error);
    }
  };

  return (
    <View className="flex-1 p-4 bg-[#023c69]">
      {/* Back Button */}
      <TouchableOpacity className="p-2 mt-6" onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>

      <View className="items-center justify-center mt-20">

        {/* FONT SIZE SETTINGS */}
        <View className="mt-6 w-full max-w-[300px]">
          <Text style={{ fontSize: fontSize, color: "white", fontWeight: "bold" }}>FONT SIZE</Text>
          <View className="flex-row justify-between items-center mt-1">
            <TouchableOpacity onPress={() => saveFontSize(Math.max(14, fontSize - 1))}>
              <Ionicons name="remove-circle-outline" size={24} color="white" />
            </TouchableOpacity>

            <TextInput
              style={{
                fontSize: fontSize,
                color: "white",
                fontWeight: "bold",
                textAlign: "center",
                borderBottomWidth: 1,
                borderBottomColor: "white",
                width: 60,
              }}
              keyboardType="numeric"
              value={fontSizeInput}
              onChangeText={(text) => setFontSizeInput(text)}
              onSubmitEditing={() => saveFontSize(Number(fontSizeInput))}
            />

            <TouchableOpacity onPress={() => saveFontSize(Math.min(28, fontSize + 1))}>
              <Ionicons name="add-circle-outline" size={24} color="white" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity className="mt-2 bg-yellow-400 p-2 rounded-lg" onPress={() => saveFontSize(Number(fontSizeInput))}>
            <Text className="text-black text-center font-bold">Save</Text>
          </TouchableOpacity>
        </View>

        {/* VIBRATION DURATION SETTINGS */}
        <View className="mt-6 w-full max-w-[300px]">
          <Text style={{ fontSize: fontSize, color: "white", fontWeight: "bold" }}>VIBRATION DURATION (ms)</Text>
          <View className="flex-row justify-between items-center mt-1">
            <TouchableOpacity onPress={() => saveVibrationDuration(Math.max(0, vibrationDuration - 50))}>
              <Ionicons name="remove-circle-outline" size={24} color="white" />
            </TouchableOpacity>

            <TextInput
              style={{
                fontSize: fontSize,
                color: "white",
                fontWeight: "bold",
                textAlign: "center",
                borderBottomWidth: 1,
                borderBottomColor: "white",
                width: 60,
              }}
              keyboardType="numeric"
              value={vibrationInput}
              onChangeText={(text) => setVibrationInput(text)}
              onSubmitEditing={() => saveVibrationDuration(Number(vibrationInput))}
            />

            <TouchableOpacity onPress={() => saveVibrationDuration(Math.min(2000, vibrationDuration + 50))}>
              <Ionicons name="add-circle-outline" size={24} color="white" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            className="mt-2 bg-yellow-400 p-2 rounded-lg"
            onPress={() => saveVibrationDuration(Number(vibrationInput))}
          >
            <Text className="text-black text-center font-bold">Save & Vibrate</Text>
          </TouchableOpacity>
        </View>

      </View>
    </View>
  );
};

export default SettingsScreen;
