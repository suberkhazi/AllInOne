import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const API_URL = 'https://poco-f1-pmos.tailbbba48.ts.net:8443/api';

export default function HoursScreen() {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [userEmail, setUserEmail] = useState('');

    // Tracker State
    const [status, setStatus] = useState('idle');
    const [punchInTime, setPunchInTime] = useState(null);
    const [breakStartTime, setBreakStartTime] = useState(null);
    const [totalBreakMinutes, setTotalBreakMinutes] = useState(0);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

    // --- THE FETCH FUNCTION (With Error Debugging) ---
    const fetchHours = async () => {
        try {
            const token = await AsyncStorage.getItem('@beryllium_token');
            const email = await AsyncStorage.getItem('@beryllium_email');
            if (email) setUserEmail(email.toLowerCase().trim());

            if (!token) {
                console.log("HOURS: No token found in storage");
                return;
            }

            const res = await axios.get(`${API_URL}/work-hours`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 8000
            });

            console.log(`HOURS: Successfully fetched ${res.data.length} entries`);
            setEntries(res.data);
        } catch (err) {
            console.log("HOURS FETCH ERROR:", err.response?.status || err.message);
            if (err.response?.status === 403) {
                Alert.alert("Session Error", "Please log out and log back in to refresh your security token.");
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Run on Tab Focus
    useFocusEffect(
        useCallback(() => {
            fetchHours();
        }, [selectedMonth])
    );

    // Load Tracker State from Storage on Mount
    useEffect(() => {
        const loadTracker = async () => {
            const s = await AsyncStorage.getItem('@wh_status');
            const p = await AsyncStorage.getItem('@wh_punchIn');
            const b = await AsyncStorage.getItem('@wh_breakStart');
            const t = await AsyncStorage.getItem('@wh_breakTotal');
            if (s) setStatus(s);
            if (p) setPunchInTime(new Date(p));
            if (b) setBreakStartTime(new Date(b));
            if (t) setTotalBreakMinutes(Number(t));
        };
        loadTracker();
    }, []);

    // Save Tracker State on Change
    useEffect(() => {
        const saveTracker = async () => {
            await AsyncStorage.setItem('@wh_status', status);
            if (punchInTime) await AsyncStorage.setItem('@wh_punchIn', punchInTime.toISOString());
            if (breakStartTime) await AsyncStorage.setItem('@wh_breakStart', breakStartTime.toISOString());
            await AsyncStorage.setItem('@wh_breakTotal', totalBreakMinutes.toString());
        };
        saveTracker();
    }, [status, punchInTime, breakStartTime, totalBreakMinutes]);

    // --- HELPERS ---
    const calculateNet = (inT, outT, brk) => {
        if (!inT || !outT) return "0.00";
        const [h1, m1] = inT.split(':').map(Number);
        const [h2, m2] = outT.split(':').map(Number);
        return (((h2 * 60 + m2) - (h1 * 60 + m1) - Number(brk)) / 60).toFixed(2);
    };

    const filteredEntries = entries.filter(e => (new Date(e.work_date).getMonth() + 1) === Number(selectedMonth));
    const totalMonthlyHours = filteredEntries.reduce((sum, e) => sum + Number(calculateNet(e.punch_in, e.punch_out, e.break_minutes)), 0);

    // --- ACTIONS ---
    const onRefresh = () => { setRefreshing(true); fetchHours(); };

    const handlePunchOut = async () => {
        const now = new Date();
        let finalBreak = totalBreakMinutes;
        if (status === 'break' && breakStartTime) finalBreak += Math.floor((now - breakStartTime) / 60000);

        try {
            const token = await AsyncStorage.getItem('@beryllium_token');
            await axios.post(`${API_URL}/work-hours`, {
                work_date: punchInTime.toISOString().split('T')[0],
                punch_in: punchInTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
                punch_out: now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
                break_minutes: finalBreak
            }, { headers: { Authorization: `Bearer ${token}` } });

            setStatus('idle'); setPunchInTime(null); setBreakStartTime(null); setTotalBreakMinutes(0);
            fetchHours();
        } catch (err) {
            Alert.alert("Sync Failed", "Check your connection to the Poco F1.");
        }
    };

    // --- PDF EXPORT ---
    const exportPDF = async () => {
        const html = `<html><body style="font-family:sans-serif;padding:40px;"><h1>Timesheet</h1>${filteredEntries.map(e => `<p>${e.work_date}: ${e.punch_in}-${e.punch_out}</p>`).join('')}</body></html>`;
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri);
    };

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />}
        >
            {/* NOTE */}
            {userEmail === 'her@gmail.com' && (
                <View style={styles.gfCard}>
                    <Text style={{ fontSize: 30 }}>❤️</Text>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.gfTitle}>Hey Gundu,</Text>
                        <Text style={styles.gfText}>Have a wonderful day. See you soon!</Text>
                    </View>
                </View>
            )}

            {/* TRACKER */}
            <View style={styles.card}>
                <Text style={styles.cardHeader}>Live Tracker</Text>
                {status === 'idle' ? (
                    <TouchableOpacity style={styles.btnGreen} onPress={() => { setPunchInTime(new Date()); setStatus('working') }}>
                        <Text style={styles.btnText}>Punch In</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity style={[styles.btnOrange, { flex: 1 }]} onPress={() => status === 'working' ? (setBreakStartTime(new Date()), setStatus('break')) : (setTotalBreakMinutes(totalBreakMinutes + Math.floor((new Date() - breakStartTime) / 60000)), setBreakStartTime(null), setStatus('working'))}>
                            <Text style={styles.btnText}>{status === 'working' ? 'Break' : 'Resume'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btnRed, { flex: 1 }]} onPress={handlePunchOut}>
                            <Text style={styles.btnText}>Finish</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* HISTORY TABLE */}
            <View style={styles.historyCard}>
                <View style={styles.row}>
                    <Text style={styles.historyTitle}>Monthly Log</Text>
                    <Text style={styles.totalHours}>{totalMonthlyHours.toFixed(2)}h</Text>
                </View>

                {/* Month Pills */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 15 }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                        <TouchableOpacity key={m} onPress={() => setSelectedMonth(m)} style={[styles.pill, selectedMonth === m && styles.pillActive]}>
                            <Text style={{ color: selectedMonth === m ? '#FFF' : '#64748B' }}>{new Date(0, m - 1).toLocaleString('en-US', { month: 'short' })}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {loading ? <ActivityIndicator color="#3B82F6" /> : filteredEntries.map(entry => (
                    <View key={entry.id} style={styles.entryRow}>
                        <View>
                            <Text style={styles.entryDate}>{new Date(entry.work_date).toLocaleDateString({ weekday: 'short', day: '2-digit' })}</Text>
                            <Text style={styles.entryTime}>{entry.punch_in.substring(0, 5)} - {entry.punch_out.substring(0, 5)}</Text>
                        </View>
                        <Text style={styles.entryNet}>{calculateNet(entry.punch_in, entry.punch_out, entry.break_minutes)}h</Text>
                    </View>
                ))}

                <TouchableOpacity style={styles.exportBtn} onPress={exportPDF}>
                    <Text style={styles.exportText}>Export PDF</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#020617', padding: 15 },
    gfCard: { backgroundColor: 'rgba(236,72,153,0.1)', padding: 15, borderRadius: 15, borderLeftWidth: 4, borderLeftColor: '#EC4899', flexDirection: 'row', marginBottom: 15 },
    gfTitle: { color: '#EC4899', fontWeight: 'bold' }, gfText: { color: '#FBCFE8' },
    card: { backgroundColor: '#0F172A', padding: 20, borderRadius: 20, marginBottom: 15, borderWidth: 1, borderColor: '#1E293B' },
    cardHeader: { color: '#64748B', marginBottom: 15, fontWeight: 'bold', textTransform: 'uppercase' },
    btnGreen: { backgroundColor: '#10B981', padding: 15, borderRadius: 12, alignItems: 'center' },
    btnOrange: { backgroundColor: '#F59E0B', padding: 15, borderRadius: 12, alignItems: 'center' },
    btnRed: { backgroundColor: '#EF4444', padding: 15, borderRadius: 12, alignItems: 'center' },
    btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
    historyCard: { backgroundColor: '#0F172A', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#1E293B' },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    historyTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
    totalHours: { color: '#10B981', fontSize: 24, fontWeight: '900' },
    pill: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1E293B', marginRight: 8 },
    pillActive: { backgroundColor: '#3B82F6' },
    entryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
    entryDate: { color: '#FFF', fontWeight: 'bold' }, entryTime: { color: '#64748B', fontSize: 12 },
    entryNet: { color: '#10B981', fontWeight: 'bold', fontSize: 16 },
    exportBtn: { marginTop: 20, backgroundColor: '#1E293B', padding: 12, borderRadius: 10, alignItems: 'center' },
    exportText: { color: '#3B82F6', fontWeight: 'bold' }
});