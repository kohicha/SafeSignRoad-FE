import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, Alert, ActivityIndicator, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
// import * as FileSystem from 'expo-file-system'; // Optional for debugging

export default function App() {
    const [recording, setRecording] = useState(null); // Use null for clearer checks
    const [isRecording, setIsRecording] = useState(false);
    const [permissionResponse, requestPermission] = Audio.usePermissions();
    const [recordedUri, setRecordedUri] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [classificationResult, setClassificationResult] = useState(null);

    const SERVER_IP = '192.168.1.11';
    const serverUrl = `http://${SERVER_IP}:8000/classify/`;


    useEffect(() => {
        (async () => {
            console.log('Requesting Microphone Permissions...');
            const { status } = await Audio.requestPermissionsAsync();
            setHasPermissions(status === 'granted');
            if (status !== 'granted') {
                Alert.alert('Permissions required', 'Microphone access is needed to record audio.');
            } else {
                console.log("Permissions granted.");

            }
        })();
    }, []);

    async function startRecording() {
        let currentPermission = permissionResponse;

        try {
            if (currentPermission?.status !== 'granted') {
                console.log('Requesting permission..');
                currentPermission = await requestPermission();
                if (currentPermission.status !== 'granted') {
                    Alert.alert('Permission Required', 'Microphone permission is needed to record.');
                    return;
                }
            }

            if (recording) {
                console.log('Stopping previous recording before starting a new one...');
                await recording.stopAndUnloadAsync();
                setRecording(null);
            }

            setIsRecording(true);
            setRecordedUri(null);
            setClassificationResult(null);

            console.log('Setting Audio Mode for recording...');
            await Audio.setAudioModeAsync({ allowsRecordingIOS: true });

            console.log('Starting new recording...');
            const newRecording = new Audio.Recording();
            await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            await newRecording.startAsync();

            console.log('Recording started successfully.');
            setRecording(newRecording);
        } catch (err) {
            console.error('Failed to start recording', err);
            Alert.alert('Error', `Failed to start recording: ${err.message || 'Unknown error'}`);
            setIsRecording(false);
            setRecording(null);
        }
    }

    async function stopRecording() {
        if (!recording) {
            console.warn("Stop recording called but no active recording found.");
            return;
        }

        console.log('Stopping recording...');
        setIsProcessing(true);

        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            console.log('Recording stopped successfully. URI:', uri);

            setRecordedUri(uri);
            setIsProcessing(false);
            setRecording(null);
            await uploadAndClassify(uri);

        } catch (err) {
            console.error('Failed to stop recording', err);
            Alert.alert('Error', `Failed to stop recording: ${err.message || 'Unknown error'}`);
        } finally {
            setIsRecording(false);
        }
    }


    async function uploadAndClassify(uri) {
        console.log(`Uploading ${uri} to ${serverUrl}`);
        const formData = new FormData();
        const filename = uri.split('/').pop();
        const fileType = Platform.OS === 'ios' ? 'audio/mp4' : 'audio/m4a'; // Adjust as needed

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
                let errorDetail = `HTTP error! status: ${response.status}`;
                try {
                    const errorJson = await response.json();
                    errorDetail = errorJson.detail || errorDetail;
                } catch (_) { /* Ignore */ }
                throw new Error(errorDetail);
            }

            const results = await response.json();
            console.log('Classification results:', results);
            setClassificationResult(results);

            if (results.ambulance > 0 || results.car_horn > 0 || results.firetruck > 0) {
                console.log('Detection found! Triggering haptics.');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                Alert.alert('Detection!', `Detected: ${
                    Object.entries(results)
                        .filter(([key, value]) => value > 0 && ['ambulance', 'car_horn', 'firetruck'].includes(key))
                        .map(([key, value]) => `${key} (${value})`)
                        .join(', ')
                }`);
            } else {
                console.log('No critical sounds detected.');
            }

        } catch (error) {
            console.error('Error uploading/classifying audio:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown upload/classification error';
            Alert.alert('API Error', `Failed to classify audio: ${errorMessage}`);
            setClassificationResult({ error: errorMessage });
        } finally {
            setIsProcessing(false);
        }
    }

    const canRecord = permissionResponse?.status === 'granted';
    const showStartButton = !isRecording;
    const showStopButton = isRecording;

    return (
        <View style={styles.container}>
            <Text style={styles.title}>SafeSignRoad PoC (JS)</Text>
            <Text>Microphone Permission: {permissionResponse?.status ?? 'loading...'}</Text>
            <Text>Status: {isRecording ? 'RECORDING' : (isProcessing ? 'Processing...' : 'Idle')}</Text>

            <View style={styles.buttonContainer}>
                {showStartButton && (
                    <Button
                        title="Start Recording"
                        onPress={startRecording}
                        disabled={!canRecord || isProcessing}
                        color="green"
                    />
                )}
                {showStopButton && (
                    <Button
                        title="Stop Recording & Classify"
                        onPress={stopRecording}
                        disabled={!isRecording}
                        color="red"
                    />
                )}
            </View>

            {isProcessing && (
                <View style={styles.statusContainer}>
                    <ActivityIndicator size="large" color="#0000ff" />
                    <Text>Classifying...</Text>
                </View>
            )}

            {recordedUri && !isProcessing && (
                <View style={styles.uriContainer}>
                    <Text>Last recording URI:</Text>
                    <Text selectable={true}>{recordedUri}</Text>
                </View>
            )}
            {classificationResult && !isProcessing && (
                <View style={styles.resultsContainer}>
                    <Text style={styles.resultsTitle}>Classification Results:</Text>
                    {classificationResult.error ? (
                        <Text style={styles.errorText}>Error: {classificationResult.error}</Text>
                    ) : (
                        Object.entries(classificationResult).map(([key, value]) => (
                            <Text key={key}>{key}: {value}</Text>
                        ))
                    )}
                </View>
            )}
        </View>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    container: { /* ... keep styles */ },
    title: { /* ... keep styles */ },
    buttonContainer: { marginVertical: 10, width: '80%', },
    statusContainer: { marginVertical: 20, alignItems: 'center', },
    resultsContainer: { marginTop: 20, padding: 15, borderWidth: 1, borderColor: '#ccc', borderRadius: 5, width: '90%', },
    resultsTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', },
    uriContainer: { marginTop: 15, padding: 5, borderColor: 'lightgrey', borderWidth: 1, width: '90%'},
    errorText: { color: 'red',},
});