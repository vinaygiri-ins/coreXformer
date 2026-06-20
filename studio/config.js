window.COREXFORMER_STUDIO_CONFIG = {
  supabaseUrl: "https://xqeqvetxezfrgwsxeyxi.supabase.co",
  supabaseAnonKey: "sb_publishable_Kv7Rl1vg3mjfv0UEQULWsA_wPmncHk-",
  siteName: "CoreXformer Studio",
  publicSiteUrl: "https://corexformer.pages.dev",
  studioAccessPath: "/studio/",
  adminWorkspacePath: "/studio/admin",
  facilitatorWorkspacePath: "/studio/facilitator",
  leadMap: {
    provider: "google",
    googleMapsApiKey: "AIzaSyD57n38xCVp87_FCtLnpZ8s-R8BWddWFUI",
    googleMapId: "",
    googleRegion: "IN",
    googleLanguage: "en",
    usageGuard: {
      enabled: true,
      timezone: "Asia/Kolkata",
      warningThresholdPercent: 60,
      criticalThresholdPercent: 80,
      hardStopThresholdPercent: 100,
      monthlyCaps: {
        mapLoads: 1000,
        autocompleteRequests: 5000,
        placeDetailsRequests: 1000,
        placeSearchRequests: 2000
      }
    }
  }
};
