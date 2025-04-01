import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Button, Alert, Platform, ActivityIndicator, TextInput, Vibration, ScrollView } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';

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
    const [serverIp, setServerIp] = useState('192.168.1.10'); // UPDATE THIS AS NEEDED
    const [serverUrl, setServerUrl] = useState(`http://${serverIp}:8000/classify/`);
    const [lastDetectionTime, setLastDetectionTime] = useState(null);

    // Update server URL when IP changes
    useEffect(() => {
        setServerUrl(`http://${serverIp}:8000/classify/`);
    }, [serverIp]);

    // Initial Permission Request & Notification Setup
    useEffect(() => {
        requestPermission();
        registerForPushNotificationsAsync();
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
            try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
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
            if (!response.ok) {
                let errTxt = `HTTP ${response.status}`;
                try {
                    const errJson = await response.json();
                    errTxt = errJson.detail || errTxt;
                } catch {}
                throw new Error(errTxt);
            }
            const results = await response.json();
            console.log('API Results:', results);
            setLastClassification(results);
            if (results.emergency_vehicle > 0 || results.car_horn > 0) {
                console.log('ML Detection! Triggering notification...');
                sendNotification(results);
            }
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
        Vibration.vibrate(500);
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

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>SafeSignRoad PoC (Interval)</Text>

            <Text style={styles.label}>Server IP:</Text>
            <TextInput
                style={styles.input}
                value={serverIp}
                onChangeText={setServerIp}
                editable={!isListening}
                keyboardType="numeric"
            />

            <Text style={styles.statusText}>Permission: {permissionResponse?.status ?? 'loading...'}</Text>
            <Text style={styles.statusText}>Monitoring: {isListening ? 'ACTIVE' : 'OFF'}</Text>
            <Text style={styles.statusText}>Recording: {isRecording ? 'Recording...' : 'Stopped'}</Text>
            <Text style={styles.statusText}>API: {isUploading ? 'Classifying...' : 'Ready'}</Text>

            <View style={styles.buttonContainer}>
                <Button
                    title={isListening ? "Stop Monitoring" : "Start Monitoring"}
                    onPress={toggleListening}
                    color={isListening ? "#F44336" : "#4CAF50"}
                    disabled={permissionResponse?.status !== 'granted'}
                />
            </View>

            {isUploading && <ActivityIndicator size="small" color="#0000ff" style={{ marginVertical: 5 }} />}
            {lastError && <Text style={styles.errorText}>Last Error: {lastError}</Text>}

            {lastClassification && (
                <View style={styles.resultsContainer}>
                    <Text style={styles.resultsTitle}>Last Classification:</Text>
                    {Object.keys(lastClassification)
                        .filter(key => key !== 'error')
                        .map((key) => (
                            <Text style={styles.resultText} key={key}>
                                {key}: {lastClassification[key]}
                            </Text>
                        ))
                    }
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f0f0f0' },
    title: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
    label: { color: '#333', fontSize: 12, marginTop: 10 },
    input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', padding: 10, width: '80%', marginVertical: 5, borderRadius: 5, textAlign: 'center' },
    statusText: { fontSize: 14, marginVertical: 2 },
    buttonContainer: { width: '80%', marginVertical: 20 },
    resultsContainer: { marginTop: 15, padding: 10, backgroundColor: '#e9e9e9', borderRadius: 5, width: '90%', alignItems: 'center' },
    resultsTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 5, textAlign: 'center' },
    resultText: { fontSize: 14, textAlign: 'center' },
    errorText: { color: 'red', marginTop: 10, width: '90%', textAlign: 'center', fontStyle: 'italic' },
});
