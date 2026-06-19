import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("after_provider_response", (event, ctx) => {
    // 1. If there is no response object at all (e.g., a hard network timeout)
    if (!event.response) {
      console.error(
        `\n[API CRASH DEBUG] Network failure: No HTTP response received from provider.`,
      );
      return;
    }

    // 2. If a response exists but it is an error status
    if (!event.response.ok) {
      console.error(
        `\n[API CRASH DEBUG] HTTP ${event.response.status}: ${event.response.statusText}`,
      );

      // Safely check for headers in case the provider abstracts them
      if (typeof event.response.headers?.get === "function") {
        const errorHeader =
          event.response.headers.get("x-error") ||
          event.response.headers.get("x-gemini-error");
        if (errorHeader) {
          console.error(`[API Header Detail]: ${errorHeader}`);
        }
      }
    }
  });
}
