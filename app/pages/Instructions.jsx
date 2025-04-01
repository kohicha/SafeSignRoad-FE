import { StyleSheet, Text, View, TouchableOpacity } from 'react-native'
import React from 'react'
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from "@expo/vector-icons"

const Instructions = () => {
  const navigation = useNavigation();
  return (
    <View className="flex-1 p-4 bg-[#023c69]">

      <TouchableOpacity className="p-2 mt-4" onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>

      <View className='flex-1 flex-col flex items-center justify-center mb-6 p-[12px] gap-4 w-full'>
        <Text className='text-white font-bold text-3xl'>1. Enable the app by granting necessary permissions</Text>
        <Text className='text-white font-bold text-3xl'>2. The app will run to monitor road conditions</Text>
        <Text className='text-white font-bold text-3xl'>3. You'll receive alerts for potential hazards based on audio data</Text>
        <Text className='text-white font-bold text-3xl'>4. Customize settings in the Settings menu as needed</Text>
      </View>

    </View>
  )
}

export default Instructions

const styles = StyleSheet.create({})