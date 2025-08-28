// ExpenseTrackerApp/screens/AuthScreen.js

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'; // Added Alert
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { app } from '../firebaseConfig'; 

const auth = getAuth(app);

const AuthScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false); // True if in registration mode
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // Loading state

  const handleAuthAction = async () => {
    setError(''); // Clear previous errors
    setLoading(true); // Start loading
    try {
      if (isRegistering) {
        // Register new account
        await createUserWithEmailAndPassword(auth, email, password);
        console.log('Registration successful!');
        Alert.alert('Success', 'Registration successful! You can now log in.');
      } else {
        // Log in
        await signInWithEmailAndPassword(auth, email, password);
        console.log('Login successful!');
        Alert.alert('Success', 'Login successful!');
      }
    } catch (err) {
      console.error('Authentication error:', err.message);
      setError(err.message); // Display error on UI
      Alert.alert('Authentication Error', err.message); // Show alert for errors
    } finally {
      setLoading(false); // Stop loading
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    Alert.alert('Google Sign-In', 'This feature requires integration with a specific Google Sign-In SDK for React Native.');
  };

  const handleFacebookSignIn = async () => {
    setError('');
    Alert.alert('Facebook Sign-In', 'This feature requires integration with a specific Facebook SDK for React Native.');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isRegistering ? 'Register' : 'Login'}</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleAuthAction} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{isRegistering ? 'Register' : 'Login'}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsRegistering(!isRegistering)}>
        <Text style={styles.switchText}>
          {isRegistering ? 'Already have an account? Login' : 'Don\'t have an account? Register'}
        </Text>
      </TouchableOpacity>

      <View style={styles.socialAuthContainer}>
        <TouchableOpacity style={styles.socialButtonGoogle} onPress={handleGoogleSignIn}>
          <Text style={styles.buttonText}>Login with Google</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.socialButtonFacebook} onPress={handleFacebookSignIn}>
          <Text style={styles.buttonText}>Login with Facebook</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f8f8',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
  },
  input: {
    width: '100%',
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  button: {
    width: '100%',
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#007AFF', 
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  switchText: {
    marginTop: 10,
    color: '#007AFF',
    fontSize: 16,
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
    textAlign: 'center',
  },
  socialAuthContainer: {
    marginTop: 30,
    width: '100%',
    alignItems: 'center',
  },
  socialButtonGoogle: {
    width: '100%',
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#DB4437', 
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  socialButtonFacebook: {
    width: '100%',
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#4267B2', 
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
});

export default AuthScreen;
