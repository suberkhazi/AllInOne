import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const API_URL = 'https://poco-f1-pmos.tailbbba48.ts.net:8443/api';

export default function DashboardScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    // REPLACE WITH YOUR ACTUAL ADMIN EMAIL
    const ADMIN_EMAIL = 'admin@poco.com';

    const [stats, setStats] = useState({ pendingTodos: 0, monthlyExpenses: 0, monthlyHours: 0 });
    const [analytics, setAnalytics] = useState({ web: 0, mobile: 0, recentLogs: [] });

    const calculateNet = (inTime, outTime, pause) => {
        if (!inTime || !outTime) return 0;
        const [h1, m1] = inTime.split(':').map(Number);
        const [h2, m2] = outTime.split(':').map(Number);
        return (((h2 * 60 + m2) - (h1 * 60 + m1) - Number(pause)) / 60);
    };

    const fetchDashboardData = async () => {
        try {
            const token = await AsyncStorage.getItem('@beryllium_token');
            const email = await AsyncStorage.getItem('@beryllium_email');

            if (!token) return;

            const userIsAdmin = email?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
            setIsAdmin(userIsAdmin);

            const config = { headers: { Authorization: `Bearer ${token}` } };

            const requests = [
                axios.get(`${API_URL}/todos`, config),
                axios.get(`${API_URL}/expenses`, config),
                axios.get(`${API_URL}/work-hours`, config)
            ];

            // ONLY ask the server for analytics if it's me
            if (userIsAdmin) {
                requests.push(axios.get(`${API_URL}/analytics`, config));
            }

            const responses = await Promise.all(requests);
            const currentMonth = new Date().getMonth() + 1;

            const pending = responses[0].data.filter(t => !t.is_completed).length;
            const expenses = responses[1].data.filter(e => (new Date(e.expense_date).getMonth() + 1) === currentMonth).reduce((sum, e) => sum + Number(e.amount), 0);
            const hours = responses[2].data.filter(h => (new Date(h.work_date).getMonth() + 1) === currentMonth).reduce((sum, h) => sum + calculateNet(h.punch_in, h.punch_out, h.break_minutes), 0);

            setStats({ pendingTodos: pending, monthlyExpenses: expenses, monthlyHours: hours });

            // Parse Analytics if Admin
            if (userIsAdmin && responses[3]) {
                setAnalytics(responses[3].data);
            }

        } catch (err) {
            console.log("Dashboard Fetch Error", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchDashboardData();
        }, [])
    );

    const handleLogout = async () => {
        await AsyncStorage.clear();
        router.replace('/');
    };

    const StatCard = ({ title, value, icon, color, route }) => (
        <TouchableOpacity style={styles.statCard} onPress={() => router.navigate(`/(tabs)/${route}`)}>
            <View style={[styles.iconBox, { backgroundColor: `${color}20` }]}>
                <Ionicons name={icon} size={28} color={color} />
            </View>
            <View>
                <Text style={styles.statValue}>{loading ? '...' : value}</Text>
                <Text style={styles.statTitle}>{title}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#475569" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
    );

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDashboardData(); }} tintColor="#3B82F6" />}
        >
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Command Center</Text>
                    <Text style={styles.subGreeting}>Here is your overview for the month.</Text>
                </View>
                <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                    <Ionicons name="log-out-outline" size={24} color="#EF4444" />
                </TouchableOpacity>
            </View>

            {/* --- ADMIN ONLY: TELEMETRY --- */}
            {isAdmin && (
                <View style={styles.adminCard}>
                    <View style={styles.adminHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="pulse" size={24} color="#3B82F6" style={{ marginRight: 8 }} />
                            <Text style={styles.adminTitle}>Live Telemetry</Text>
                        </View>
                        <View style={styles.adminBadge}>
                            <Ionicons name="shield" size={12} color="#EF4444" style={{ marginRight: 4 }} />
                            <Text style={styles.adminBadgeText}>Admin Only</Text>
                        </View>
                    </View>

                    <View style={styles.trafficRow}>
                        <View style={styles.trafficBox}>
                            <Text style={styles.trafficLabel}>Web</Text>
                            <Text style={styles.trafficValue}>{loading ? '-' : analytics.web}</Text>
                        </View>
                        <View style={styles.trafficBox}>
                            <Text style={styles.trafficLabel}>Mobile</Text>
                            <Text style={styles.trafficValue}>{loading ? '-' : analytics.mobile}</Text>
                        </View>
                        <View style={styles.trafficBox}>
                            <Text style={styles.trafficLabel}>Total Pings</Text>
                            <Text style={[styles.trafficValue, { color: '#10B981' }]}>{loading ? '-' : analytics.web + analytics.mobile}</Text>
                        </View>
                    </View>

                    <Text style={styles.recentLogsTitle}>RECENT CONNECTIONS</Text>
                    {loading ? <ActivityIndicator size="small" color="#3B82F6" /> : analytics.recentLogs.map((log, idx) => (
                        <View key={idx} style={styles.logRow}>
                            <View style={{ flex: 1, paddingRight: 10 }}>
                                <Text style={styles.logIp}>{log.ip_address}</Text>
                                <Text style={styles.logHardware} numberOfLines={1}>{log.device_model} • {log.os}</Text>
                                <Text style={styles.logLocation} numberOfLines={1}>{log.location}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <View style={[styles.platformBadge, log.platform === 'web' ? { backgroundColor: '#3B82F620' } : { backgroundColor: '#A855F720' }]}>
                                    <Text style={[styles.platformText, log.platform === 'web' ? { color: '#60A5FA' } : { color: '#C084FC' }]}>{log.platform.toUpperCase()}</Text>
                                </View>
                                <Text style={styles.logTime}>{new Date(log.accessed_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* --- STANDARD KPI METRICS --- */}
            <Text style={styles.sectionTitle}>Your Metrics</Text>
            <View style={styles.metricsContainer}>
                <StatCard title="Pending Tasks" value={stats.pendingTodos} icon="checkmark-circle" color="#3B82F6" route="todos" />
                <StatCard title="Monthly Spend" value={`€${stats.monthlyExpenses.toFixed(2)}`} icon="receipt" color="#10B981" route="expenses" />
                <StatCard title="Net Hours" value={`${stats.monthlyHours.toFixed(1)}h`} icon="time" color="#F59E0B" route="hours" />
            </View>

            <View style={styles.infoBox}>
                <Ionicons name="shield-checkmark" size={24} color="#10B981" style={{ marginBottom: 10 }} />
                <Text style={styles.infoTitle}>Secure Connection Active</Text>
                <Text style={styles.infoText}>All data is securely routed through your network to the Beryllium Core server.</Text>
            </View>

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#020617', padding: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, marginTop: 10 },
    greeting: { fontSize: 28, fontWeight: '900', color: '#F8FAFC' },
    subGreeting: { color: '#94A3B8', fontSize: 14, marginTop: 5 },
    logoutBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },

    // Admin Styles
    adminCard: { backgroundColor: '#0F172A', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#1E293B', marginBottom: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 10 },
    adminHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    adminTitle: { color: '#FFF', fontSize: 20, fontWeight: '900' },
    adminBadge: { flexDirection: 'row', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignItems: 'center' },
    adminBadgeText: { color: '#EF4444', fontSize: 12, fontWeight: 'bold' },
    trafficRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, backgroundColor: '#020617', padding: 15, borderRadius: 16 },
    trafficBox: { alignItems: 'center' },
    trafficLabel: { color: '#64748B', fontSize: 12, fontWeight: 'bold', marginBottom: 5 },
    trafficValue: { color: '#FFF', fontSize: 22, fontWeight: '900' },
    recentLogsTitle: { color: '#64748B', fontSize: 11, fontWeight: 'bold', marginBottom: 10, letterSpacing: 1 },
    logRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E293B50', padding: 12, borderRadius: 12, marginBottom: 8 },
    logIp: { color: '#E2E8F0', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginBottom: 2 },
    logHardware: { color: '#94A3B8', fontSize: 11, marginBottom: 2 },
    logLocation: { color: '#64748B', fontSize: 10 },
    platformBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 5 },
    platformText: { fontSize: 10, fontWeight: 'bold' },
    logTime: { color: '#94A3B8', fontSize: 12 },

    sectionTitle: { color: '#E2E8F0', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
    metricsContainer: { gap: 15, marginBottom: 30 },
    statCard: { backgroundColor: '#0F172A', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#1E293B', flexDirection: 'row', alignItems: 'center' },
    iconBox: { width: 50, height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    statValue: { fontSize: 24, fontWeight: '900', color: '#FFF' },
    statTitle: { color: '#94A3B8', fontSize: 14, fontWeight: 'bold' },

    infoBox: { backgroundColor: 'rgba(16, 185, 129, 0.05)', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)', alignItems: 'center', marginBottom: 40 },
    infoTitle: { color: '#10B981', fontWeight: 'bold', fontSize: 16, marginBottom: 5 },
    infoText: { color: '#64748B', textAlign: 'center', fontSize: 13, lineHeight: 20 }
});