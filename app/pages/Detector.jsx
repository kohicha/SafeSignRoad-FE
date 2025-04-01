import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Button, Alert, Platform, ActivityIndicator, TextInput, Vibration, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export default function Detector() {
    const [permissionResponse, requestPermission] = Audio.usePermissions();
    const recordingRef = useRef(null);
    const [isListening, setIsListening] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [lastClassification, setLastClassification] = useState(null);
    const [lastError, setLastError] = useState(null);
    const [serverUrl, setServerUrl] = useState(`http://kohicha.eastasia.cloudapp.azure.com:8000/classify/`);
    const [lastDetectionTime, setLastDetectionTime] = useState(null);
    const navigation = useNavigation();
    const [vibrationDuration, setVibrationDuration] = useState(500);
    const [fontSize, setFontSize] = useState(14);
    const [notificationPermission, setNotificationPermission] = useState(null);


    // Initial Permission Request & Notification Setup
    useEffect(() => {
        requestPermission();
        registerForPushNotificationsAsync();
    }, []);

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

    const setupAudioMode = async () => {
        try {
            await Audio.setAudioModeAsync({ allowsRecordingIOS: true });
            console.log("Audio mode set.");
            return true;
        } catch (err) {
            console.error("Failed to set audio mode", err);
            setLastError("Audio mode setup failed");
            return false;
        }
    };

    const startNewRecording = async () => {
        if (recordingRef.current) {
            console.warn("Cleaning up previous recording...");
            try { await recordingRef.current.stopAndUnloadAsync(); } catch { }
            recordingRef.current = null;
        }
        let newRecording = null;
        try {
            if (permissionResponse?.status !== 'granted') { throw new Error("Microphone permission not granted."); }
            if (!await setupAudioMode()) { throw new Error("Audio mode setup failed."); }

            console.log('Creating recording instance...');
            const { recording: recordingObject } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            newRecording = recordingObject;
            if (!newRecording) throw new Error("Failed to create recording object.");
            recordingRef.current = newRecording;
            console.log("Recording object created.");

            setIsRecording(true);
            setLastError(null);

            console.log('Attempting recording start...');
            await newRecording.startAsync();
            console.log('Recording started.');
            return true;
        } catch (err) {
            console.error("Error in startNewRecording:", err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            const knownError = "Start encountered an error: recording not started";
            if (errorMessage === knownError) {
                console.warn(`Known error '${knownError}', proceeding tentatively...`);
                setLastError(`Warn: ${knownError} (Tentative)`);
                if (!isRecording) setIsRecording(true);
                return true;
            } else {
                setLastError(`Start Error: ${errorMessage}`);
                setIsRecording(false);
                recordingRef.current = null;
                return false;
            }
        }
    };

    const stopCurrentRecording = async () => {
        if (!recordingRef.current) return null;
        console.log("Stopping recording...");
        let uri = null;
        const recordingObjToStop = recordingRef.current;
        recordingRef.current = null;
        setIsRecording(false);
        try {
            await recordingObjToStop.stopAndUnloadAsync();
            uri = recordingObjToStop.getURI();
            console.log(`Stopped successfully. URI: ${uri}`);
            setLastError(null);
        } catch (error) {
            console.error("Failed to stop/unload:", error);
            setLastError(`Stop Error: ${error.message || 'Unknown'}`);
        }
        return uri;
    };

    async function uploadAndClassify(uri) {
        if (!uri) return;
        setIsUploading(true);
        setLastError(null);
        console.log(`Uploading ${uri}...`);
        const formData = new FormData();
        const filename = uri.split('/').pop();
        const fileType = Platform.OS === 'ios' ? 'audio/mp4' : 'audio/m4a';
        formData.append('file', { uri, name: filename || 'audio.m4a', type: fileType });

        try {
            const response = await fetch(serverUrl, { method: 'POST', body: formData });
            if (!response.ok) { let errTxt = `HTTP ${response.status}`; try {const errJson=await response.json(); errTxt = errJson.detail || errTxt;} catch{} throw new Error(errTxt); }
            const results = await response.json(); // Expect { emergency_vehicle: x, car_horn: y, traffic: z }
            console.log('API Results:', results);
            setLastClassification(results); // Update UI state

            // *** START: New Alert Logic (Replaces sendNotification call) ***
            let alertTitle = null;
            let alertMessage = null;

            // Check for emergency vehicle first
            if (results.emergency_vehicle > 0) {
                alertTitle = "Emergency Vehicle Alert! 🚨"; // sirens emoji U+1F6A8
                alertMessage = "Emergency vehicle detected nearby!";
            }
            // Check for car horn (can happen alongside emergency)
            else if (results.car_horn > 0) { // Use else if to only show one alert per interval, prioritizing emergency
                alertTitle = "Car Horn Alert! 🔊"; // speaker emoji U+1F50A
                alertMessage = "Car horn detected nearby!";
            }

            // If a relevant sound was detected, trigger debounced alert
            if (alertTitle) {
                const now = Date.now();
                const DEBOUNCE_MS = 5000; // Only alert every 5 seconds max
                if (lastDetectionTime && now - lastDetectionTime < DEBOUNCE_MS) {
                    console.log(`Alert (${alertTitle}) debounced.`);
                } else {
                    setLastDetectionTime(now); // Update timestamp
                    console.log(`ALERTING (Pop-up): ${alertTitle}`);

                    // 1. Haptics
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    // 2. Vibration
                    Vibration.vibrate(vibrationDuration); // Use duration from state
                    // 3. Pop-up Alert
                    Alert.alert(alertTitle, alertMessage);
                    // 4. Optional Push Notification (Removed for simplicity as requested pop-up)
                    // try { Notifications.scheduleNotificationAsync({ content: { title: alertTitle, body: alertMessage }, trigger: null }); } catch(e) {console.error("Push failed:", e)}
                }
            }
            // *** END: New Alert Logic ***

        } catch (error) {
            console.error('Upload/Classify Error:', error);
            setLastError(error.message || 'Upload/Classification failed');
            setLastClassification(null);
        } finally {
            setIsUploading(false);
        }
    }

    async function sendNotification(results = null) {
        const now = Date.now();
        if (lastDetectionTime && now - lastDetectionTime < 5000) {
            console.log("Notification debounced.");
            return;
        }
        setLastDetectionTime(now);
        console.log(`🚨 Critical Sound DETECTED by ML!`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Vibration.vibrate(vibrationDuration);
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: "Sound Alert",
                    body: "Emergency vehicle or horn detected!",
                },
                trigger: null,
            });
            console.log("Push notification scheduled.");
        } catch (e) {
            console.error("Failed to schedule push notification:", e);
        }
        Vibration.vibrate(vibrationDuration);
    }

    async function registerForPushNotificationsAsync() {
        try {
            const { status } = await Notifications.requestPermissionsAsync({
                ios: {
                    allowAlert: true,
                    allowBadge: true,
                    allowSound: true,
                },
            });
            if (status !== 'granted') {
                Alert.alert('Permission required', 'Enable notifications in settings.');
            }
        } catch (error) {
            console.error("Notification permission error:", error);
        }
    }

    // --- Interval Management ---

    useEffect(() => {
        let intervalId = null;
        let isEffectActive = true;
        const RECORDING_DURATION_MS = 5000;
        const INTERVAL_MS = RECORDING_DURATION_MS + 200;

        const handleIntervalTick = async () => {
            if (!isEffectActive || !isListening) return;
            console.log("--- Interval Tick ---");
            const uri = await stopCurrentRecording();
            if (isListening && isEffectActive) {
                const startSuccess = await startNewRecording();
                if (uri && startSuccess && !isUploading) {
                    uploadAndClassify(uri);
                } else if (uri && isUploading) {
                    console.warn("Skipping upload: previous processing.");
                }
            }
            console.log("--- Interval Cycle End ---");
        };

        const startMonitoringSequence = async () => {
            if (!isEffectActive) return;
            console.log("Starting monitoring sequence...");
            setLastError(null);
            setLastClassification(null);
            if (permissionResponse?.status !== 'granted') {
                Alert.alert("Permission Denied", "Microphone permission required.");
                setIsListening(false);
                return;
            }
            const firstStartSuccess = await startNewRecording();
            if (isEffectActive && isListening && firstStartSuccess) {
                if (intervalId) clearInterval(intervalId);
                intervalId = setInterval(handleIntervalTick, INTERVAL_MS);
                console.log(`Interval set (${INTERVAL_MS}ms)`);
            } else if (isEffectActive && isListening && !firstStartSuccess) {
                setIsListening(false);
            }
        };

        if (isListening) {
            startMonitoringSequence();
        }

        return () => {
            console.log("Cleanup: stopping monitoring...");
            isEffectActive = false;
            if (intervalId) {
                clearInterval(intervalId);
                console.log("Interval cleared.");
            }
            if (recordingRef.current) {
                recordingRef.current.stopAndUnloadAsync()
                    .catch(e => console.error("Cleanup unload failed:", e))
                    .finally(() => { recordingRef.current = null; });
            }
            setIsRecording(false);
            setIsUploading(false);
        };
    }, [isListening]);

    const toggleListening = () => setIsListening(current => !current);

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
        <ScrollView contentContainerStyle={styles.container} className='bg-[#023c69] h-full'>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <View className='content' style={styles.content}>
                <Text className='text-white font-bold' style={dynamicStyles.label}>SafeSignRoad Proof-Of-Concept</Text>

                <Text className='text-white font-bold' style={dynamicStyles.label}>Permission: {permissionResponse?.status ?? 'loading...'}</Text>
                <Text className='text-white font-bold' style={dynamicStyles.label}>Monitoring: {isListening ? 'ACTIVE' : 'OFF'}</Text>
                <Text className='text-white font-bold' style={dynamicStyles.label}>Recording: {isRecording ? 'Recording...' : 'Stopped'}</Text>
                <Text className='text-white font-bold' style={dynamicStyles.label}>API: {isUploading ? 'Classifying...' : 'Ready'}</Text>

                <View style={styles.buttonContainer} className='my-2'>
                    <Button
                        title={isListening ? "Stop Monitoring" : "Start Monitoring"}
                        onPress={toggleListening}
                        color={isListening ? "#F44336" : "#4CAF50"}
                        disabled={permissionResponse?.status !== 'granted'}
                    />
                </View>

                {isUploading && <ActivityIndicator size="small" color="#0000ff" style={{ marginVertical: 5 }} />}
                {lastClassification && (
                    <View style={styles.resultsContainer}>
                        <Text className='text-white font-bold' style={dynamicStyles.label}>Last Classification:</Text>
                        {Object.keys(lastClassification)
                            .filter(key => key !== 'error')
                            .map((key) => (
                                <Text className='text-white font-bold' style={styles.resultText} key={key}>
                                    {key}: {lastClassification[key]}
                                </Text>
                            ))
                        }
                    </View>
                )}
            </View>

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { backgroundColor: '#023c69', padding: 20 },
    backButton: { marginTop: 5, padding: 10 },
    content: { alignItems: 'center', marginTop: 20 },
    button: { backgroundColor: '#fbd713', padding: 15, borderRadius: 8, width: 250, alignItems: 'center', marginBottom: 10 },
    resultsContainer: { marginTop: 20, padding: 15, borderWidth: 1, borderColor: 'gray', borderRadius: 5, width: '90%' },
});