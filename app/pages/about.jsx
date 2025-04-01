import { StyleSheet, Text, View, TouchableOpacity } from 'react-native'
import React from 'react'
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from "@expo/vector-icons"

const about = () => {
    const navigation = useNavigation();
    return (
        <View className="flex-1 p-4 bg-[#023c69]">

            <TouchableOpacity className="absolute top-10 left-5" onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>

            <View className='items-center justify-center flex flex-1 gap-6'>
                <Text className='text-white font-bold text-3xl '>About</Text>

                <Text className='text-white font-bold text-2xl w-full'>
                    SafeSign Roads is an innovative application designed to enhance road safety
                    by utilizing advanced audio to detect and alert
                    users about potential road hazards. </Text>
                <Text className='text-white font-bold text-2xl w-full'>
                    The app continuously monitors the environment
                    for unusual sounds, sudden changes in traffic conditions, and hazardous areas,
                    providing real-time notifications to drivers, cyclists, and pedestrians.
                </Text>
                <Text className='text-white font-bold text-2xl w-full '>
                    SafeSign Roads
                    aims to reduce accidents and improve overall road awareness for a safer travel experience.</Text>
            </View>

        </View>
    )
}

export default about

const styles = StyleSheet.create({})