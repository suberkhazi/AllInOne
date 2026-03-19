import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const API_URL = 'https://poco-f1-pmos.tailbbba48.ts.net:8443/api';

export default function AuthScreen() {
    const [isRegistering, setIsRegistering] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {

        const sendPing = async () => {
            try {
                await axios.post(`${API_URL}/track-access`, {
                    platform: 'mobile',
                    device_model: Device.modelName || 'Unknown Mobile', // e.g., "iPhone 14 Pro"
                    os: `${Device.osName} ${Device.osVersion}` // e.g., "iOS 17.2"
                });
            } catch (e) { console.log("Analytics ping skipped."); }
        };
        sendPing();

        const checkToken = async () => {
            try {
                const savedToken = await AsyncStorage.getItem('@beryllium_token');
                if (savedToken) router.replace('/(tabs)/dashboard');
                else setIsLoading(false);
            } catch (e) { setIsLoading(false); }
        };
        checkToken();
    }, []);

    const handleAuth = async () => {
        if (!email || !password || (isRegistering && !name)) {
            return Alert.alert("Error", "Please fill in all fields.");
        }

        setIsLoading(true);
        try {
            // 1. If Registering, create the account first
            if (isRegistering) {
                await axios.post(`${API_URL}/register`, { name, email, password });
            }

            // 2. Log them in (happens automatically after register, or directly if just logging in)
            const res = await axios.post(`${API_URL}/login`, { email, password });

            // 3. Save Token & Email locally
            await AsyncStorage.setItem('@beryllium_token', res.data.token);
            await AsyncStorage.setItem('@beryllium_email', email.toLowerCase().trim());

            setTimeout(() => { router.replace('/(tabs)/dashboard'); }, 100);
        } catch (err) {
            Alert.alert("Authentication Failed", err.response?.data?.error || "Cannot connect to server.");
            setIsLoading(false);
        }
    };

    if (isLoading) return <View style={styles.container}><ActivityIndicator size="large" color="#3B82F6" /></View>;

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>

                <View style={styles.iconContainer}>
                    <Ionicons name="shield-checkmark" size={60} color="#3B82F6" />
                </View>

                <View style={styles.card}>
                    <Text style={styles.title}>{isRegistering ? 'Create Account' : 'All In One'}</Text>
                    <Text style={styles.subtitle}>{isRegistering ? 'Join the secure network' : 'Mobile Secure Access'}</Text>

                    {isRegistering && (
                        <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor="#64748B" value={name} onChangeText={setName} />
                    )}

                    <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#64748B" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
                    <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#64748B" value={password} onChangeText={setPassword} secureTextEntry />

                    <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={isLoading}>
                        <Text style={styles.buttonText}>{isRegistering ? 'Sign Up' : 'Sign In'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.toggleWrap} onPress={() => setIsRegistering(!isRegistering)}>
                        <Text style={styles.toggleText}>
                            {isRegistering ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                        </Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#020617', padding: 20 },
    iconContainer: { alignItems: 'center', marginBottom: 20 },
    card: { backgroundColor: '#0F172A', padding: 30, borderRadius: 24, borderWidth: 1, borderColor: '#1E293B', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15 },
    title: { fontSize: 32, fontWeight: '900', color: '#60A5FA', textAlign: 'center', marginBottom: 5 },
    subtitle: { color: '#94A3B8', textAlign: 'center', marginBottom: 30 },
    input: { backgroundColor: '#1E293B', color: '#F8FAFC', padding: 15, borderRadius: 12, marginBottom: 15, fontSize: 16 },
    button: { backgroundColor: '#2563EB', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
    buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    toggleWrap: { marginTop: 25, alignItems: 'center' },
    toggleText: { color: '#94A3B8', fontSize: 14, fontWeight: '500' }
});