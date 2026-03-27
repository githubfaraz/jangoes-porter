import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jangoes.porter',
  appName: 'Jangoes Porter',
  webDir: 'dist',
  server: {
    // During development, load from your dev server instead of static files.
    // Comment this out for production builds.
    // url: 'http://YOUR_LOCAL_IP:3000',
    // cleartext: true,
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      backgroundColor: '#1a1a2e',
    },
    StatusBar: {
      style: 'DARK',
    },
  },
};

export default config;
