import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.themarcompany.pluck",
  appName: "PLUCK",
  webDir: "out",
  server: {
    // Point multiplayer at the Railway server
    // (solo play works fully offline)
  },
  ios: {
    scheme: "PLUCK",
    contentInset: "automatic",
  },
};

export default config;
