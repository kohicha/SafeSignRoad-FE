import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, Alert, ActivityIndicator, TextInput, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

export default function Index() {
    const [recording, setRecording] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [permissionResponse, requestPermission] = Audio.usePermissions();
    const [recordedUri, setRecordedUri] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [classificationResult, setClassificationResult] = useState(null);
    const [serverIp, setServerIp] = useState('192.168.1.15');
    const [serverUrl, setServerUrl] = useState(`http://${serverIp}:8000/classify/`);

    useEffect(() => {
        setServerUrl(`http://${serverIp}:8000/classify/`);
    }, [serverIp]);

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

            await Audio.setAudioModeAsync({ allowsRecordingIOS: true });

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
        } catch (error) {
            Alert.alert('API Error', `Failed to classify audio: ${error.message}`);
            setClassificationResult({ error: error.message });
        } finally {
            setIsProcessing(false);
        }
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>SafeSignRoad PoC (JS)</Text>
            <Text>Enter Server IP:</Text>
            <TextInput
                style={styles.input}
                value={serverIp}
                onChangeText={setServerIp}
                placeholder="Enter server IP"
                keyboardType="numeric"
            />
            <Text>Status: {isRecording ? 'RECORDING' : (isProcessing ? 'Processing...' : 'Idle')}</Text>
            <View style={styles.buttonContainer}>
                <Button title="Start Recording" onPress={startRecording} disabled={isRecording || isProcessing} color="green" />
                <Button title="Stop Recording & Classify" onPress={stopRecording} disabled={!isRecording} color="red" />
            </View>
            {isProcessing && <ActivityIndicator size="large" color="#0000ff" />}
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

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    title: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
    input: { borderWidth: 1, borderColor: '#ccc', padding: 10, width: '80%', marginVertical: 10, borderRadius: 5, },
    buttonContainer: { flexDirection: 'row', justifyContent: 'space-around', width: '80%', marginVertical: 10 },
    resultsContainer: { marginTop: 20, padding: 15, borderWidth: 1, borderColor: '#ccc', borderRadius: 5, width: '90%', },
    resultsTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', },
    errorText: { color: 'red', },
});