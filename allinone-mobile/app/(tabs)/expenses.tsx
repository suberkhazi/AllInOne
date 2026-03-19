import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, FlatList, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';

const API_URL = 'https://poco-f1-pmos.tailbbba48.ts.net:8443/api';

export default function ExpensesScreen() {
    const [view, setView] = useState('scan'); // 'scan' or 'history'
    const [isScanning, setIsScanning] = useState(false);
    const [pendingItems, setPendingItems] = useState([]);
    const [manualDesc, setManualDesc] = useState('');
    const [manualAmount, setManualAmount] = useState('');

    // History State
    const [history, setHistory] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedIds, setSelectedIds] = useState([]);

    useEffect(() => {
        if (view === 'history') fetchHistory();
    }, [view, selectedMonth]);

    const fetchHistory = async () => {
        try {
            const token = await AsyncStorage.getItem('@beryllium_token');
            const res = await axios.get(`${API_URL}/expenses`, { headers: { Authorization: `Bearer ${token}` } });
            setHistory(res.data);
            setSelectedIds([]);
        } catch (err) { console.log(err); }
    };

    // --- SCANNER LOGIC ---
    const takePhoto = async () => {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return Alert.alert("Permission Required");
        const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
        if (!result.canceled) uploadReceipt(result.assets[0].uri);
    };

    const uploadReceipt = async (uri) => {
        setIsScanning(true);
        try {
            const token = await AsyncStorage.getItem('@beryllium_token');
            const formData = new FormData();
            formData.append('receipt', { uri, name: 'receipt.jpg', type: 'image/jpeg' });
            const res = await axios.post(`${API_URL}/expenses/scan`, formData, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
            setPendingItems(prev => [...prev, ...res.data.items]);
        } catch (err) { Alert.alert("Scan Failed"); } finally { setIsScanning(false); }
    };

    const addManualItem = () => {
        if (!manualDesc || !manualAmount) return;
        setPendingItems(prev => [...prev, { description: manualDesc, amount: manualAmount.replace(',', '.'), expense_date: new Date().toISOString().split('T')[0] }]);
        setManualDesc(''); setManualAmount('');
    };

    const saveBatch = async () => {
        if (pendingItems.length === 0) return;
        try {
            const token = await AsyncStorage.getItem('@beryllium_token');
            await axios.post(`${API_URL}/expenses/bulk`, { items: pendingItems }, { headers: { Authorization: `Bearer ${token}` } });
            Alert.alert("Success", "Saved!"); setPendingItems([]);
        } catch (err) { Alert.alert("Error"); }
    };

    // --- HISTORY LOGIC ---
    const toggleSelection = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const deleteSelected = async () => {
        if (selectedIds.length === 0) return;
        try {
            const token = await AsyncStorage.getItem('@beryllium_token');
            await axios.post(`${API_URL}/expenses/bulk-delete`, { ids: selectedIds }, { headers: { Authorization: `Bearer ${token}` } });
            fetchHistory();
        } catch (err) { Alert.alert("Delete failed"); }
    };

    const filteredHistory = history.filter(item => (new Date(item.expense_date).getMonth() + 1) === Number(selectedMonth));
    const totalAmount = filteredHistory.reduce((sum, item) => sum + Number(item.amount), 0);

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>

            {/* Top Toggle */}
            <View style={styles.toggleRow}>
                <TouchableOpacity style={[styles.toggleBtn, view === 'scan' && styles.toggleActive]} onPress={() => setView('scan')}>
                    <Text style={[styles.toggleText, view === 'scan' && styles.toggleTextActive]}>Scanner</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleBtn, view === 'history' && styles.toggleActive]} onPress={() => setView('history')}>
                    <Text style={[styles.toggleText, view === 'history' && styles.toggleTextActive]}>History</Text>
                </TouchableOpacity>
            </View>

            {view === 'scan' ? (
                <View style={{ flex: 1 }}>
                    <TouchableOpacity style={styles.scanButton} onPress={takePhoto} disabled={isScanning}>
                        {isScanning ? <ActivityIndicator color="#FFF" /> : <><Ionicons name="camera" size={24} color="#FFF" style={{ marginRight: 10 }} /><Text style={styles.scanButtonText}>Scan Receipt</Text></>}
                    </TouchableOpacity>

                    <View style={styles.manualCard}>
                        <TextInput style={[styles.input, { marginBottom: 10 }]} placeholder="Item (e.g. Coffee)" placeholderTextColor="#64748B" value={manualDesc} onChangeText={setManualDesc} />
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TextInput style={[styles.input, { flex: 1 }]} placeholder="€ 0.00" placeholderTextColor="#64748B" value={manualAmount} onChangeText={setManualAmount} keyboardType="numeric" />
                            <TouchableOpacity style={styles.addButton} onPress={addManualItem}><Ionicons name="add" size={24} color="#FFF" /></TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.listHeaderRow}>
                        <Text style={styles.listHeader}>Pending ({pendingItems.length})</Text>
                        {pendingItems.length > 0 && <TouchableOpacity style={styles.saveButton} onPress={saveBatch}><Text style={styles.saveButtonText}>Save All</Text></TouchableOpacity>}
                    </View>
                    <FlatList
                        data={pendingItems}
                        keyExtractor={(item, idx) => idx.toString()}
                        renderItem={({ item, index }) => (
                            <View style={styles.itemRow}>
                                <View style={{ flex: 1 }}><Text style={styles.itemDesc}>{item.description}</Text><Text style={styles.itemAmount}>€{Number(item.amount).toFixed(2)}</Text></View>
                                <TouchableOpacity onPress={() => setPendingItems(pendingItems.filter((_, i) => i !== index))}><Ionicons name="trash" size={20} color="#EF4444" /></TouchableOpacity>
                            </View>
                        )}
                    />
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    <View style={styles.filterRow}>
                        <Text style={styles.statsValue}>€{totalAmount.toFixed(2)}</Text>
                        {selectedIds.length > 0 && (
                            <TouchableOpacity style={styles.deleteBulkBtn} onPress={deleteSelected}>
                                <Ionicons name="trash" size={16} color="#FFF" style={{ marginRight: 5 }} />
                                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Del ({selectedIds.length})</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Month Filter Pills */}
                    <View style={{ flexDirection: 'row', marginBottom: 20 }}>
                        <FlatList horizontal showsHorizontalScrollIndicator={false} data={Array.from({ length: 12 }, (_, i) => i + 1)} keyExtractor={item => item.toString()}
                            renderItem={({ item }) => (
                                <TouchableOpacity onPress={() => setSelectedMonth(item)} style={[styles.monthPill, selectedMonth === item && styles.monthPillActive]}>
                                    <Text style={[styles.monthPillText, selectedMonth === item && styles.monthPillTextActive]}>{new Date(0, item - 1).toLocaleString('en-US', { month: 'short' })}</Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>

                    <FlatList
                        data={filteredHistory}
                        keyExtractor={item => item.id.toString()}
                        renderItem={({ item }) => (
                            <View style={styles.itemRow}>
                                <TouchableOpacity onPress={() => toggleSelection(item.id)} style={{ marginRight: 15 }}>
                                    <Ionicons name={selectedIds.includes(item.id) ? "checkbox" : "square-outline"} size={24} color={selectedIds.includes(item.id) ? "#3B82F6" : "#64748B"} />
                                </TouchableOpacity>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.itemDesc}>{item.description}</Text>
                                    <Text style={styles.itemDate}>{new Date(item.expense_date).toLocaleDateString('de-DE')}</Text>
                                </View>
                                <Text style={styles.itemAmount}>€{Number(item.amount).toFixed(2)}</Text>
                            </View>
                        )}
                    />
                </View>
            )}
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#020617', padding: 20 },
    toggleRow: { flexDirection: 'row', backgroundColor: '#0F172A', borderRadius: 12, padding: 5, marginBottom: 20 },
    toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
    toggleActive: { backgroundColor: '#3B82F6' },
    toggleText: { color: '#64748B', fontWeight: 'bold' },
    toggleTextActive: { color: '#FFF' },

    scanButton: { backgroundColor: '#4F46E5', flexDirection: 'row', paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    scanButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
    manualCard: { backgroundColor: '#0F172A', padding: 15, borderRadius: 16, borderColor: '#1E293B', borderWidth: 1, marginBottom: 20 },
    input: { backgroundColor: '#1E293B', color: '#FFF', padding: 12, borderRadius: 10 },
    addButton: { backgroundColor: '#3B82F6', padding: 12, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

    listHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    listHeader: { fontSize: 18, fontWeight: 'bold', color: '#F8FAFC' },
    saveButton: { backgroundColor: '#10B981', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
    saveButtonText: { color: '#FFF', fontWeight: 'bold' },

    itemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', padding: 15, borderRadius: 12, marginBottom: 10, borderColor: '#1E293B', borderWidth: 1 },
    itemDesc: { color: '#E2E8F0', fontSize: 16, fontWeight: 'bold' },
    itemDate: { color: '#64748B', fontSize: 12, marginTop: 4 },
    itemAmount: { color: '#10B981', fontSize: 16, fontWeight: 'bold' },

    filterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    statsValue: { color: '#10B981', fontSize: 32, fontWeight: '900' },
    deleteBulkBtn: { backgroundColor: '#EF4444', flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },

    monthPill: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1E293B', marginRight: 10 },
    monthPillActive: { backgroundColor: '#3B82F6' },
    monthPillText: { color: '#64748B', fontWeight: 'bold' },
    monthPillTextActive: { color: '#FFF' }
});