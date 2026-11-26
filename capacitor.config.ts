import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.digo.evolution',
  appName: 'DIGO Evolution',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
