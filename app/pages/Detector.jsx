import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Alert, ActivityIndicator, TextInput, Platform, TouchableOpacity, Vibration } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

export default function Index() {
    const [recording, setRecording] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [permissionResponse, requestPermission] = Audio.usePermissions();
    const [notificationPermission, setNotificationPermission] = useState(null);

    const [recordedUri, setRecordedUri] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [classificationResult, setClassificationResult] = useState(null);
    const [serverIp, setServerIp] = useState('192.168.1.15');
    const [serverUrl, setServerUrl] = useState(`http://${serverIp}:8000/classify/`);
    const [vibrationDuration, setVibrationDuration] = useState(500);
    const [fontSize, setFontSize] = useState(14); // Add state for font size
    const navigation = useNavigation();

    useEffect(() => {
        setServerUrl(`http://${serverIp}:8000/classify/`);
    }, [serverIp]);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                // Load vibration settings
                const storedVibration = await AsyncStorage.getItem("vibrationDuration");
                if (storedVibration !== null) {
                    const parsedVibration = Number.parseInt(storedVibration, 10);
                    setVibrationDuration(parsedVibration);
                }

                // Load font size settings
                const storedFontSize = await AsyncStorage.getItem("fontSize");
                if (storedFontSize !== null) {
                    const parsedFontSize = Number.parseInt(storedFontSize, 10);
                    setFontSize(parsedFontSize);
                }
            } catch (error) {
                console.error("Error loading settings:", error);
            }
        };

        loadSettings();
    }, []);

    useEffect(() => {
        const requestNotificationPermissions = async () => {
            const currentPermission = await Notifications.getPermissionsAsync();
            setNotificationPermission(currentPermission);

            if (currentPermission.status !== 'granted') {
                const permissionResult = await Notifications.requestPermissionsAsync();
                setNotificationPermission(permissionResult);

                if (permissionResult.status !== 'granted') {
                    Alert.alert('Permission Required', 'Push notification permission is needed for alerts.');
                }
            }
        };

        requestNotificationPermissions();
    }, []);

    async function startRecording() {
        let currentPermission = permissionResponse;

        try {
            if (currentPermission?.status !== 'granted') {
                currentPermission = await requestPermission();
                if (currentPermission.status !== 'granted') {
                    Alert.alert('Permission Required', 'Microphone permission is needed to record.');
                    return;
                }
            }

            if (recording) {
                await recording.stopAndUnloadAsync();
                setRecording(null);
            }

            setIsRecording(true);
            setRecordedUri(null);
            setClassificationResult(null);

            await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

            const newRecording = new Audio.Recording();
            await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            await newRecording.startAsync();

            setRecording(newRecording);
        } catch (err) {
            Alert.alert('Error', `Failed to start recording: ${err.message || 'Unknown error'}`);
            setIsRecording(false);
            setRecording(null);
        }
    }

    async function stopRecording() {
        if (!recording) return;

        setIsProcessing(true);

        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setRecordedUri(uri);
            setRecording(null);
            await uploadAndClassify(uri);
        } catch (err) {
            Alert.alert('Error', `Failed to stop recording: ${err.message || 'Unknown error'}`);
        } finally {
            setIsRecording(false);
        }
    }

    async function uploadAndClassify(uri) {
        const formData = new FormData();
        const filename = uri.split('/').pop();
        const fileType = Platform.OS === 'ios' ? 'audio/mp4' : 'audio/m4a';

        formData.append('file', {
            uri: uri,
            name: filename || 'audio.m4a',
            type: fileType,
        });

        try {
            const response = await fetch(serverUrl, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const results = await response.json();
            setClassificationResult(results);

            if (results && Object.keys(results).length > 0) {
                notifyUser(results);
            }
        } catch (error) {
            Alert.alert('API Error', `Failed to classify audio: ${error.message}`);
            setClassificationResult({ error: error.message });
        } finally {
            setIsProcessing(false);
        }
    }

    async function schedulePushNotification(title, body) {
        if (notificationPermission?.status !== 'granted') {
            console.log("No notification permission, skipping push notification");
            return;
        }

        await Notifications.scheduleNotificationAsync({
            content: {
                title: title,
                body: body,
                sound: true,
                priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: null,
        });
    }

    async function notifyUser(results) {
        const detectedClasses = Object.entries(results)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');

        Alert.alert('Detection Alert', `Detected:\n${detectedClasses}`);

        if (vibrationDuration > 0) {
            Vibration.vibrate(vibrationDuration);
            console.log(`Vibrating for ${vibrationDuration}ms`);
        }

        Vibration.vibrate(vibrationDuration);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        let highestItem = Object.entries(results).reduce(
            (max, current) => current[1] > max[1] ? current : max,
            ['', 0]
        );

        await schedulePushNotification(
            'SafeSignRoad Alert',
            `Detected: ${highestItem[0]} (${highestItem[1]})`
        );

        Vibration.vibrate(vibrationDuration);
    }

    // Generate dynamic styles based on font size
    const dynamicStyles = {
        title: { fontSize: fontSize + 8, fontWeight: 'bold', color: 'white', marginBottom: 10 },
        label: { fontSize: fontSize + 2, color: 'white', marginBottom: 5 },
        input: { borderWidth: 1, borderColor: 'gray', padding: 10, width: 250, borderRadius: 5, color: 'white', marginBottom: 10, fontSize },
        status: { fontSize: fontSize + 2, color: 'white', marginBottom: 20 },
        buttonText: { fontSize: fontSize + 2, fontWeight: 'bold', color: 'black' },
        resultsTitle: { fontSize: fontSize + 4, fontWeight: 'bold', color: 'white', marginBottom: 10, textAlign: 'center' },
        resultText: { fontSize: fontSize + 2, color: 'white' },
        errorText: { color: 'red', fontSize: fontSize + 2 },
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>

            <View style={styles.content}>
                <Text style={dynamicStyles.title}>SafeSignRoad PoC (JS)</Text>
                <Text style={dynamicStyles.label}>Enter Server IP:</Text>

                <TextInput
                    style={dynamicStyles.input}
                    value={serverIp}
                    onChangeText={setServerIp}
                    placeholder="Enter server IP"
                    keyboardType="numeric"
                    placeholderTextColor="gray"
                />

                <Text style={dynamicStyles.status}>Status: {isRecording ? 'RECORDING' : (isProcessing ? 'Processing...' : 'Idle')}</Text>

                <TouchableOpacity style={styles.button} onPress={startRecording} disabled={isRecording || isProcessing}>
                    <Text style={dynamicStyles.buttonText}>Start Recording</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.button} onPress={stopRecording} disabled={!isRecording}>
                    <Text style={dynamicStyles.buttonText}>Stop Recording & Classify</Text>
                </TouchableOpacity>

                {isProcessing && <ActivityIndicator size="large" color="white" />}

                {classificationResult && !isProcessing && (
                    <View style={styles.resultsContainer}>
                        <Text style={dynamicStyles.resultsTitle}>Classification Results:</Text>
                        {classificationResult.error ? (
                            <Text style={dynamicStyles.errorText}>Error: {classificationResult.error}</Text>
                        ) : (
                            Object.entries(classificationResult).map(([key, value]) => (
                                <Text key={key} style={dynamicStyles.resultText}>{key}: {value}</Text>
                            ))
                        )}
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#023c69', padding: 20 },
    backButton: { marginTop: 20, padding: 10 },
    content: { alignItems: 'center', marginTop: 50 },
    button: { backgroundColor: '#fbd713', padding: 15, borderRadius: 8, width: 250, alignItems: 'center', marginBottom: 10 },
    resultsContainer: { marginTop: 20, padding: 15, borderWidth: 1, borderColor: 'gray', borderRadius: 5, width: '90%' },
});