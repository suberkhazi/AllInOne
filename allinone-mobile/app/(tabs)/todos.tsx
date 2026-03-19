import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const API_URL = 'https://poco-f1-pmos.tailbbba48.ts.net:8443/api';

export default function TodosScreen() {
    const [todos, setTodos] = useState([]);
    const [newTask, setNewTask] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);

    // Edit State
    const [editingId, setEditingId] = useState(null);
    const [editTaskText, setEditTaskText] = useState('');

    const syncWithServer = async () => {
        setIsSyncing(true);
        try {
            const token = await AsyncStorage.getItem('@beryllium_token');
            if (!token) return;
            const res = await axios.get(`${API_URL}/todos`, { headers: { Authorization: `Bearer ${token}` } });
            setTodos(res.data);
            await AsyncStorage.setItem('@beryllium_todos', JSON.stringify(res.data));
        } catch (error) {
            const local = await AsyncStorage.getItem('@beryllium_todos');
            if (local) setTodos(JSON.parse(local));
        } finally { setIsSyncing(false); }
    };

    useEffect(() => { syncWithServer(); }, []);

    const handleAddTask = async () => {
        if (!newTask.trim()) return;
        try {
            const token = await AsyncStorage.getItem('@beryllium_token');
            if (!token) {
                Alert.alert("Session Expired", "Please log out and log back in.");
                return;
            }

            await axios.post(`${API_URL}/todos`,
                { task: newTask },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setNewTask('');
            await syncWithServer(); // Refresh the list
        } catch (error) {
            console.log("Add Task Error:", error.response?.status);
            Alert.alert("Sync Error", "Server returned an error. Check your connection.");
        }
    };

    const toggleComplete = async (todo) => {
        try {
            const token = await AsyncStorage.getItem('@beryllium_token');
            await axios.put(`${API_URL}/todos/${todo.id}`, { task: todo.task, is_completed: !todo.is_completed }, { headers: { Authorization: `Bearer ${token}` } });
            syncWithServer();
        } catch (err) { }
    };

    const saveEdit = async (todo) => {
        try {
            const token = await AsyncStorage.getItem('@beryllium_token');
            await axios.put(`${API_URL}/todos/${todo.id}`, { task: editTaskText, is_completed: todo.is_completed }, { headers: { Authorization: `Bearer ${token}` } });
            setEditingId(null); syncWithServer();
        } catch (err) { Alert.alert("Error", "Could not save edit"); }
    };

    const deleteTask = async (id) => {
        try {
            const token = await AsyncStorage.getItem('@beryllium_token');
            await axios.delete(`${API_URL}/todos/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            syncWithServer();
        } catch (err) { Alert.alert("Error", "Could not delete"); }
    };

    // --- MOBILE PDF EXPORT ---
    const exportPDF = async () => {
        let tableRows = todos.map(todo => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${todo.is_completed ? '✅ Done' : '⏳ Pending'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; ${todo.is_completed ? 'text-decoration: line-through; color: #888;' : ''}">${todo.task}</td>
      </tr>
    `).join('');

        const htmlContent = `
      <html>
        <body style="font-family: Helvetica; padding: 40px;">
          <h1 style="color: #3B82F6;">Beryllium Core: To-Do Report</h1>
          <table style="width: 100%; text-align: left; border-collapse: collapse; margin-top: 20px;">
            <tr style="background-color: #F8FAFC; color: #333;">
              <th style="padding: 10px;">Status</th><th style="padding: 10px;">Task</th>
            </tr>
            ${tableRows}
          </table>
        </body>
      </html>
    `;
        try {
            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } catch (err) { Alert.alert("Error", "Could not generate PDF"); }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>To-Do List</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                    {isSyncing && <ActivityIndicator color="#60A5FA" />}
                    <TouchableOpacity onPress={exportPDF} style={styles.pdfButton}>
                        <Ionicons name="download" size={18} color="#FFF" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.inputContainer}>
                <TextInput style={styles.input} placeholder="New Task..." placeholderTextColor="#64748B" value={newTask} onChangeText={setNewTask} />
                <TouchableOpacity style={styles.addButton} onPress={handleAddTask}><Text style={styles.addButtonText}>+</Text></TouchableOpacity>
            </View>

            <FlatList
                data={todos}
                keyExtractor={item => item.id.toString()}
                renderItem={({ item }) => (
                    <View style={styles.todoCard}>
                        <TouchableOpacity onPress={() => toggleComplete(item)} style={{ marginRight: 15 }}>
                            <Ionicons name={item.is_completed ? "checkmark-circle" : "ellipse-outline"} size={28} color={item.is_completed ? "#10B981" : "#64748B"} />
                        </TouchableOpacity>

                        {editingId === item.id ? (
                            <TextInput style={styles.editInput} autoFocus value={editTaskText} onChangeText={setEditTaskText} onSubmitEditing={() => saveEdit(item)} />
                        ) : (
                            <Text style={[styles.todoText, item.is_completed && styles.completedText]} onPress={() => { setEditingId(item.id); setEditTaskText(item.task); }}>
                                {item.task}
                            </Text>
                        )}

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            {editingId === item.id ? (
                                <TouchableOpacity onPress={() => saveEdit(item)}><Ionicons name="save" size={24} color="#10B981" /></TouchableOpacity>
                            ) : (
                                <TouchableOpacity onPress={() => deleteTask(item.id)}><Ionicons name="trash" size={24} color="#EF4444" /></TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#020617', padding: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 28, fontWeight: 'bold', color: '#60A5FA' },
    pdfButton: { backgroundColor: '#1E293B', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
    inputContainer: { flexDirection: 'row', marginBottom: 20 },
    input: { flex: 1, backgroundColor: '#1E293B', color: '#F8FAFC', padding: 15, borderRadius: 12, marginRight: 10 },
    editInput: { flex: 1, backgroundColor: '#1E293B', color: '#FFF', padding: 5, borderRadius: 8, borderColor: '#3B82F6', borderWidth: 1 },
    addButton: { backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', width: 55, borderRadius: 12 },
    addButtonText: { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
    todoCard: { backgroundColor: '#0F172A', padding: 15, borderRadius: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderColor: '#1E293B', borderWidth: 1 },
    todoText: { flex: 1, color: '#F1F5F9', fontSize: 16 },
    completedText: { textDecorationLine: 'line-through', color: '#64748B' }
});