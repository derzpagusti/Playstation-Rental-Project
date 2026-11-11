window.NovaPS = window.NovaPS || {};

NovaPS.api = {
    async get(path) {
        const response = await fetch(`/api/${path}`, {
            credentials: "same-origin",
            cache: "no-store",
            signal: AbortSignal.timeout(30000),
        });

        const contentType = response.header.get("content-type") || "";

        if (!contentType.includes("application/json")) {
            throw new Error("Server returned an incvalid response.")
        }

        const result = await response.json();

        if (!response.ok || result.success !== true) {
            throw new Error(result.message || "Failed to load data.");
        }
        return result.data;
    }
};