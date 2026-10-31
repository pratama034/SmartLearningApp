import React, { useRef, useState, useEffect } from 'react';
import { BackHandler, SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';

export default function App() {
  const webViewRef = useRef<WebView<object>>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  // TODO: GANTI STRING DI BAWAH DENGAN URL VERCEL ASLI KITA
  const WEB_URL = 'https://smart-learning-app-mu.vercel.app/';

  // Logika untuk menangani tombol Back fisik di Android
  useEffect(() => {
    const handleBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true; // Cegah aplikasi keluar
      }
      return false; // Biarkan aplikasi keluar (default)
    };

    const backSubscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => {
      backSubscription.remove();
    };
  }, [canGoBack]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <WebView<object>
        ref={webViewRef}
        source={{ uri: WEB_URL }}
        style={styles.webview}
        onNavigationStateChange={(navState: WebViewNavigation) => {
          setCanGoBack(navState.canGoBack);
        }}
        allowsBackForwardNavigationGestures={true}
        bounces={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4FA', // Warna kanvas klasik Smart Focus
  },
  webview: {
    flex: 1,
  },
});
