(() => {
    window.NovaPS = window.NovaPS || {};

    const baseUrl = (
        document.currentScript.dataset.apiBase || "/api"
    ).replace(/\/+$/, "");

    NovaPS.api = {
        async get(path) {
            const response = await fetch(
                `${baseUrl}/${path.replace(/^\/+/, "")}`,
                {
                    credentials: "same-origin",
                    cache: "no-store",
                    signal: AbortSignal.timeout(15000),
                }
            );

            const contentType = response.headers.get("content-type") || "";

            if (!contentType.includes("application/json")) {
                throw new Error("Respons server bukan JSON. Periksa alamat API.");
            }

            const result = await response.json();

            if (!response.ok || result.success !== true) {
                throw new Error(result.message || "Data gagal dimuat.");
            }

            return result.data;
        },
    };
})();